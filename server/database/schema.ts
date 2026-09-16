import { sqliteTable, integer, text, real, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core'

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
  workedSolutionImagePath: text('worked_solution_image_path'),
  difficulty: integer('difficulty'),
  type: text('type', { enum: ['multiple_choice', 'free_response'] }).notNull().default('multiple_choice'),
  answerType: text('answer_type', { enum: ['numeric', 'text'] }),
  answerNumericValue: real('answer_numeric_value'),
  answerTolerancePercent: real('answer_tolerance_percent'),
  answerText: text('answer_text'),
  answerUnitHint: text('answer_unit_hint'),
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

export const papers = sqliteTable('papers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const paperSections = sqliteTable('paper_sections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  paperId: integer('paper_id').notNull().references(() => papers.id, { onDelete: 'cascade' }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'restrict' }),
  questionCount: integer('question_count').notNull(),
  timeLimitSeconds: integer('time_limit_seconds').notNull(),
  sortOrder: integer('sort_order').notNull().default(0)
}, table => [
  uniqueIndex('idx_paper_sections_order').on(table.paperId, table.sortOrder)
])

export const paperAttempts = sqliteTable('paper_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  paperId: integer('paper_id').notNull().references(() => papers.id, { onDelete: 'restrict' }),
  studentId: integer('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['in_progress', 'completed', 'abandoned'] }).notNull().default('in_progress'),
  currentSectionIndex: integer('current_section_index').notNull().default(0),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
  createdAt: integer('created_at').notNull()
}, table => [
  index('idx_paper_attempts_student').on(table.studentId, table.startedAt)
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
  paperAttemptId: integer('paper_attempt_id').references(() => paperAttempts.id, { onDelete: 'cascade' }),
  paperSectionIndex: integer('paper_section_index'),
  createdAt: integer('created_at').notNull()
}, table => [
  index('idx_sessions_student').on(table.studentId, table.startedAt),
  index('idx_sessions_paper_attempt').on(table.paperAttemptId, table.paperSectionIndex)
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
  submittedAnswerText: text('submitted_answer_text'),
  isCorrect: integer('is_correct', { mode: 'boolean' }),
  hintUsed: integer('hint_used', { mode: 'boolean' }).notNull().default(false),
  flagged: integer('flagged', { mode: 'boolean' }).notNull().default(false),
  timeSpentMs: integer('time_spent_ms'),
  presentedAt: integer('presented_at'),
  answeredAt: integer('answered_at')
}, table => [
  uniqueIndex('idx_ssq_session_seq').on(table.quizSessionId, table.sequenceIndex),
  index('idx_ssq_question_session').on(table.questionId, table.quizSessionId)
])
