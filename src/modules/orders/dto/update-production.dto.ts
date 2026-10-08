import { IsIn } from 'class-validator';
export const PRODUCTION_STAGES = ['todo', 'printing', 'finishing', 'ready'] as const;
export type ProductionStage = typeof PRODUCTION_STAGES[number];
export class UpdateProductionDto {
  @IsIn(PRODUCTION_STAGES)
  stage!: ProductionStage;
}
