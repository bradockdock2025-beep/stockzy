import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SuggestionsQueryDto } from './dto/suggestions-query.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Public()
  @Get('suggestions')
  suggestions(@Query() query: SuggestionsQueryDto) {
    return this.searchService.suggestions(query);
  }
}
