import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserTenantMap } from './entities/user-tenant-map.entity';
import { AdminUser } from './entities/admin-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserTenantMap, AdminUser])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
