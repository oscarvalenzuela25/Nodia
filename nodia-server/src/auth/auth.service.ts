import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, MoreThan } from 'typeorm';
import { User } from '../user/entities/user.entity.js';
import { AuthSession } from './entities/auth-session.entity.js';

@Injectable()
export class AuthService {
  constructor(private readonly dataSource: DataSource) {}

  transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(work);
  }

  findLoginUser(email: string, manager: EntityManager): Promise<User | null> {
    return manager
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.google_sub')
      .where('LOWER(TRIM(user.email)) = :email', { email })
      .setLock('pessimistic_write')
      .getOne();
  }

  saveUser(user: User, manager: EntityManager): Promise<User> {
    return manager.getRepository(User).save(user);
  }

  saveSession(
    session: Partial<AuthSession>,
    manager: EntityManager,
  ): Promise<AuthSession> {
    return manager.getRepository(AuthSession).save(session);
  }

  lockSession(
    publicId: string,
    manager: EntityManager,
  ): Promise<AuthSession | null> {
    return manager
      .getRepository(AuthSession)
      .createQueryBuilder('session')
      .addSelect('session.refresh_token_hash')
      .where('session.public_id = :publicId', { publicId })
      .setLock('pessimistic_write')
      .getOne();
  }

  findUser(
    id: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<User | null> {
    return manager.getRepository(User).findOneBy({ id, is_active: true });
  }

  findActiveSession(
    publicId: string,
    userId: string,
  ): Promise<AuthSession | null> {
    return this.dataSource.getRepository(AuthSession).findOneBy({
      public_id: publicId,
      user_id: userId,
      revoked_at: IsNull(),
      expires_at: MoreThan(new Date()),
    });
  }

  async revokeSession(publicId: string, userId: string): Promise<void> {
    await this.dataSource
      .getRepository(AuthSession)
      .update(
        { public_id: publicId, user_id: userId, revoked_at: IsNull() },
        { revoked_at: new Date() },
      );
  }
}
