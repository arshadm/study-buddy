import { sqliteTable, integer, text, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role', { enum: ['admin', 'student'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, table => [
  index('idx_users_role').on(table.role)
])

export const subjects = sqliteTable('subjects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  defaultQuestionCount: integer('default_question_count').notNull().default(20),
  defaultTimeLimitSeconds: integer('default_time_limit_seconds').notNull().default(1800),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const questions = sqliteTable('questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  imagePath: text('image_path').notNull(),
  hintText: text('hint_text'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, table => [
  index('idx_questions_subject').on(table.subjectId, table.isActive)
])

export const questionOptions = sqliteTable('question_options', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  questionId: integer('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  optionText: text('option_text').notNull(),
  isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0)
}, table => [
  index('idx_options_question').on(table.questionId)
])

export const quizSessions = sqliteTable('quiz_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['in_progress', 'completed', 'abandoned'] }).notNull().default('in_progress'),
  plannedQuestionCount: integer('planned_question_count').notNull(),
  timeLimitSeconds: integer('time_limit_seconds').notNull(),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
  scoreCorrect: integer('score_correct'),
  scoreTotal: integer('score_total'),
  createdAt: integer('created_at').notNull()
}, table => [
  index('idx_sessions_student').on(table.studentId, table.startedAt)
])

export const quizSessionSubjects = sqliteTable('quiz_session_subjects', {
  quizSessionId: integer('quiz_session_id').notNull().references(() => quizSessions.id, { onDelete: 'cascade' }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'restrict' }),
  questionCount: integer('question_count').notNull(),
  timeLimitSeconds: integer('time_limit_seconds').notNull()
}, table => [
  primaryKey({ columns: [table.quizSessionId, table.subjectId] })
])

export const quizSessionQuestions = sqliteTable('quiz_session_questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quizSessionId: integer('quiz_session_id').notNull().references(() => quizSessions.id, { onDelete: 'cascade' }),
  questionId: integer('question_id').notNull().references(() => questions.id, { onDelete: 'restrict' }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'restrict' }),
  sequenceIndex: integer('sequence_index').notNull(),
  selectedOptionId: integer('selected_option_id').references(() => questionOptions.id, { onDelete: 'set null' }),
  isCorrect: integer('is_correct', { mode: 'boolean' }),
  hintUsed: integer('hint_used', { mode: 'boolean' }).notNull().default(false),
  timeSpentMs: integer('time_spent_ms'),
  presentedAt: integer('presented_at'),
  answeredAt: integer('answered_at')
}, table => [
  uniqueIndex('idx_ssq_session_seq').on(table.quizSessionId, table.sequenceIndex),
  index('idx_ssq_question_session').on(table.questionId, table.quizSessionId)
])
