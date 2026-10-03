import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CheckActionPermissionUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(userId: string, actionKey: string): Promise<void> {
    const rows: Array<{ allowed: boolean }> = await this.dataSource.query(
      `SELECT EXISTS (
         SELECT 1
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id AND r.is_active = true
         LEFT JOIN role_actions ra ON ra.role_id = r.id AND ra.is_active = true
         LEFT JOIN actions a ON a.id = ra.action_id AND a.is_active = true
         WHERE ur.user_id = $1 AND ur.is_active = true
           AND (r.key = 'super_admin' OR a.key = $2)
       ) AS allowed`,
      [userId, actionKey],
    );
    if (rows[0]?.allowed !== true) {
      throw new ForbiddenException('Insufficient action permission');
    }
  }
}
