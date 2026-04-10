// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from './entities/user.entity';
import { DeepPartial } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(user: CreateUserDto): Promise<User> {
    try {
      const userData = {
        firstName: user.identity.firstName,
        lastName: user.identity.lastName,
        dateOfBirth: user.identity.dateOfBirth,
        gender: user.identity.gender,
        email: user.contact?.email || null,
        phoneNumber: user.contact.phoneNumber,
        password: user.contact.password,
        role: user.identity.role,
        healthId: await this.generateHealthId(user.identity.role),
      };

      const newUser = this.usersRepository.create(
        userData as DeepPartial<User>,
      );
      await this.usersRepository.save(newUser);

      return newUser;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  // Soft delete a user
  async softDelete(id: string): Promise<{ message: string; user: User }> {
    try {
      // Find the user
      const user = await this.usersRepository.findOne({
        where: { id },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // Check if already deleted
      if (user.deletedAt) {
        throw new ConflictException(`User with ID ${id} is already deleted`);
      }

      // Perform soft delete - this sets the deletedAt column
      await this.usersRepository.softDelete(id);

      // Fetch the soft-deleted user to return
      const deletedUser = await this.usersRepository.findOne({
        where: { id },
        withDeleted: true, // Important: This includes soft-deleted records
      });

      return {
        message: `User with ID ${id} has been soft deleted successfully`,
        user: deletedUser as User,
      };
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to soft delete user');
    }
  }

  // Restore a soft-deleted user
  async restore(id: string): Promise<{ message: string; user: User }> {
    try {
      // Find the user including soft-deleted ones
      const user = await this.usersRepository.findOne({
        where: { id },
        withDeleted: true,
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // Check if not deleted
      if (!user.deletedAt) {
        throw new ConflictException(`User with ID ${id} is not deleted`);
      }

      // Restore the user - this sets deletedAt to null
      await this.usersRepository.restore(id);

      // Fetch the restored user
      const restoredUser = await this.usersRepository.findOne({
        where: { id },
      });

      return {
        message: `User with ID ${id} has been restored successfully`,
        user: restoredUser as User,
      };
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to restore user');
    }
  }

  // Permanently delete a user (hard delete)
  async permanentDelete(id: string): Promise<{ message: string }> {
    try {
      // Find user including soft-deleted ones
      const user = await this.usersRepository.findOne({
        where: { id },
        withDeleted: true,
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // Permanently remove from database
      await this.usersRepository.delete(id);

      return {
        message: `User with ID ${id} has been permanently deleted`,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to permanently delete user',
      );
    }
  }

  // Find all users (not soft-deleted)
  async findAll(page = 1, limit = 20): Promise<User[]> {
    try {
      return await this.usersRepository.find({
        take: limit,
        skip: (page - 1) * limit,
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch all users');
    }
  }

  // Find all active users (not soft-deleted)
  async findAllActive(page = 1, limit = 20): Promise<User[]> {
    try {
      // This automatically excludes soft-deleted users
      return await this.usersRepository.find({
        where: { isActive: true },
        take: limit,
        skip: (page - 1) * limit,
      });
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch active users');
    }
  }

  // Find all users including soft-deleted ones
  async findAllIncludingDeleted(page = 1, limit = 20): Promise<User[]> {
    try {
      return await this.usersRepository.find({
        withDeleted: true, // Includes soft-deleted records
        take: limit,
        skip: (page - 1) * limit,
      });
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch all users');
    }
  }

  // Find only soft-deleted users
  async findSoftDeleted(): Promise<User[]> {
    try {
      return await this.usersRepository.find({
        withDeleted: true,
      });
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch soft-deleted users',
      );
    }
  }

  // Find a single user by ID (excluding soft-deleted by default)
  async findOne(id: string): Promise<User> {
    try {
      const user = await this.usersRepository.findOne({
        where: { id },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return user;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  // Find a single user including soft-deleted
  async findOneIncludingDeleted(id: string): Promise<User> {
    try {
      const user = await this.usersRepository.findOne({
        where: { id },
        withDeleted: true,
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return user;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  // Bulk soft delete multiple users
  async bulkSoftDelete(
    ids: string[],
  ): Promise<{ message: string; deletedCount: number }> {
    try {
      const result = await this.usersRepository.softDelete(ids);

      return {
        message: `${result.affected} users have been soft deleted successfully`,
        deletedCount: result.affected || 0,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to bulk soft delete users',
      );
    }
  }

  // Bulk restore multiple users
  async bulkRestore(
    ids: string[],
  ): Promise<{ message: string; restoredCount: number }> {
    try {
      const result = await this.usersRepository.restore(ids);

      return {
        message: `${result.affected} users have been restored successfully`,
        restoredCount: result.affected || 0,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to bulk restore users');
    }
  }

  private async generateHealthId(role: UserRole): Promise<string> {
    const prefix = this.getRolePrefix(role);
    let healthId: string = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 20;

    while (!isUnique && attempts < maxAttempts) {
      const randomId = this.generateRandomAlphanumeric(8);
      healthId = `${prefix}-${randomId}`;

      // Check if this healthId already exists
      const existingUser = await this.usersRepository.findOne({
        where: { healthId },
      });

      if (!existingUser) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      // If we couldn't generate a unique ID after max attempts, add timestamp
      const timestamp = Date.now().toString().slice(-4);
      const randomId = this.generateRandomAlphanumeric(4);
      healthId = `${prefix}-${randomId}${timestamp}`;
    }

    return healthId;
  }

  private getRolePrefix(role: UserRole): string {
    const prefixes = {
      [UserRole.PATIENT]: 'PAT',
      [UserRole.DOCTOR]: 'DOC',
      [UserRole.HOSPITAL]: 'HOS',
      [UserRole.ADMIN]: 'ADM',
    };
    return prefixes[role];
  }

  private generateRandomAlphanumeric(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const array = new Array(length);
    for (let i = 0; i < length; i++) {
      array[i] = characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }
    return array.join('');
  }
}
