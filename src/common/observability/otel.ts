import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';

const enabled = process.env.OTEL_ENABLED === 'true' || !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
if (!enabled) {
  // Tracing disabled by default unless OTEL_ENABLED=true or exporter endpoint is provided.
} else {
  const diagLevel = process.env.OTEL_DIAG_LOG_LEVEL;
  if (diagLevel) {
    const level =
      DiagLogLevel[diagLevel as keyof typeof DiagLogLevel] ?? DiagLogLevel.INFO;
    diag.setLogger(new DiagConsoleLogger(), level);
  }

  const serviceName = process.env.OTEL_SERVICE_NAME ?? 'stockzy-ecommerce-api';
  const headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      headers,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  const shutdown = () => {
    sdk.shutdown().catch(() => undefined);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

function parseHeaders(raw?: string) {
  if (!raw) {
    return undefined;
  }

  return raw.split(',').reduce<Record<string, string>>((acc, entry) => {
    const [key, value] = entry.split('=').map((part) => part.trim());
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {});
}
