import { db } from '../../config/knex.js';

export interface CourseRow {
  id: number;
  university_name: string;
  level_name: string;
  course_name: string;
}

export const coursesRepository = {
  /** Read-only — `courses` is a Laravel-owned catalog table; chat only
   * needs it to populate the course picker when creating a course group. */
  list(query?: string) {
    const builder = db<CourseRow>('courses')
      .where('status', 1)
      .select('id', 'university_name', 'level_name', 'course_name')
      .orderBy('position');

    if (query) builder.andWhere('course_name', 'like', `%${query}%`);
    return builder.limit(100);
  },
};
