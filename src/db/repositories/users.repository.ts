import { db } from '../../config/knex.js';
import type { UserRow } from '../schema-types.js';

const STAFF_TYPES = new Set(['Teacher', 'Admin', 'Admin Staff']);

export const usersRepository = {
  async findById(id: number) {
    return db<UserRow>('users').where({ id }).first();
  },

  async isStaff(userId: number): Promise<boolean> {
    const user = await this.findById(userId);
    return !!user?.type && STAFF_TYPES.has(user.type);
  },
};
