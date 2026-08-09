import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CategoriesService } from './categories.service';

/**
 * Leitura pública de categorias (menu/navegação do storefront). O CRUD (create/update/
 * delete/merge) mora só em CategoriesAdminController (`/admin/categories`) — este
 * controller aqui existia antes como uma cópia admin-only do mesmo CRUD, sem nenhuma
 * rota pública de verdade (bug: bloqueava o menu público). Substituído por isto.
 */
@Public()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findTree() {
    return this.categoriesService.findPublicTree();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.categoriesService.findPublicOne(id);
  }
}
