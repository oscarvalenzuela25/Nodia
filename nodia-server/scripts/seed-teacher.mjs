import 'reflect-metadata';
import source from '../dist/config/data-source.js';
import { TeacherNavigationService } from '../dist/teacher/teacher-navigation.service.js';
import { SeedTeacherNavigationUseCase } from '../dist/teacher/use-case/seed-teacher-navigation.use-case.js';

// Optional operator command. Never called by startup/build/migration or feature discovery.
// No role/user/module assignments: ordinarily select /nodia-teacher in the module maintainer.
try {
  await source.initialize();
  const result = await new SeedTeacherNavigationUseCase(source, new TeacherNavigationService()).execute();
  console.log(JSON.stringify({ registration_only: true, user_assignments_created: 0, ...result }));
} finally {
  if (source.isInitialized) await source.destroy();
}
