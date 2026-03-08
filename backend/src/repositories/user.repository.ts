import { User, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma'; // <-- Import the shared instance

export class UserRepository {
  /**
   * Creates a new user in the database.
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data }); // Now uses the shared instance
  }

  /**
   * Finds a user by their unique email address.
   */
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } }); // Now uses the shared instance
  }

  /**
   * Finds a user by their unique ID.
   */
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } }); // Now uses the shared instance
  }

  /**
   * Updates a user's password hash.
   */
  async updatePassword(userId: string, passwordHash: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });
  }
}