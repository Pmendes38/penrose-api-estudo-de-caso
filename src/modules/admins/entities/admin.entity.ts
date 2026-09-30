import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Admin } from '../types/admin.types';

export class AdminEntity implements Admin {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ example: 'email@example.com' }) email!: string;
  @ApiProperty({ enum: ['admin'] }) role!: 'admin';
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  @Exclude() password?: string;

  private static coerceDate(value: unknown, field: string): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && value) {
      const d = new Date(value);
      if (!Number.isNaN(+d)) return d;
    }
    throw new Error(`${field} is required and must be a valid date`);
  }

  static from(doc: Partial<Admin> & Record<string, any>): AdminEntity {
    const e = new AdminEntity();
    e.id = doc.id!;
    e.name = (doc as any).name!;
    e.email = doc.email!;
    e.role = (doc.role ?? 'admin') as 'admin';
    e.createdAt = AdminEntity.coerceDate(doc.createdAt, 'createdAt');
    e.updatedAt = AdminEntity.coerceDate(doc.updatedAt, 'updatedAt');
    return e;
  }
}