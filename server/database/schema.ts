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
  // Optional custom instructions folded into every LLM grading prompt for this subject's
  // discussion activities — e.g. the grader's role and how strict to be (see claude-cli.ts).
  gradingInstructions: text('grading_instructions'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const sections = sqliteTable('sections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, table => [
  uniqueIndex('idx_sections_subject_name').on(table.subjectId, table.name)
])

// Resources for LLM-graded open-response activities (syllabus/mark scheme/textbook chapters).
// 'syllabus' and 'mark_scheme' are single-current-version per subject (enforced in the API,
// not here, by replacing the existing row of that role on re-upload); 'chapter' is many-per-subject.
export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['syllabus', 'mark_scheme', 'chapter'] }).notNull(),
  title: text('title').notNull(),
  filePath: text('file_path').notNull(),
  extractedText: text('extracted_text'),
  extractionError: text('extraction_error'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, table => [
  index('idx_documents_subject').on(table.subjectId, table.role)
])

export const questions = sqliteTable('questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  // Organizes questions for admin management only — students are still
  // tested across the whole subject (all sections combined); every other
  // query keeps filtering by subjectId, never sectionId.
  sectionId: integer('section_id').references(() => sections.id, { onDelete: 'set null' }),
  imagePath: text('image_path').notNull(),
  hintText: text('hint_text'),
  // Required (enforced in the API, not the DB) when type is 'self_marked_image', since
  // that's what the student checks their own uploaded answer against.
  workedSolutionImagePath: text('worked_solution_image_path'),
  difficulty: integer('difficulty'),
  type: text('type', { enum: ['multiple_choice', 'self_marked_image'] }).notNull().default('multiple_choice'),
  // Only meaningful when type is 'multiple_choice' — 'text' carries question_options rows,
  // 'image' means the single question image already shows the options, and the correct
  // answer is just the short label below (e.g. "a"), matched case-insensitively.
  optionFormat: text('option_format', { enum: ['text', 'image'] }).notNull().default('text'),
  // Required (enforced in the API) when optionFormat is 'image'; unused otherwise.
  correctAnswerText: text('correct_answer_text'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, table => [
  index('idx_questions_subject').on(table.subjectId, table.isActive),
  index('idx_questions_section').on(table.sectionId)
])

export const questionOptions = sqliteTable('question_options', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  questionId: integer('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  // Exactly one of optionText / optionImagePath is set, matching the parent question's optionFormat.
  optionText: text('option_text'),
  optionImagePath: text('option_image_path'),
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
  submittedAnswerImagePath: text('submitted_answer_image_path'),
  // The student's typed answer for a multiple_choice + optionFormat 'image' question.
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

// --- LLM-graded open-response ("discussion") activities ---

export const openQuestionSets = sqliteTable('open_question_sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  sectionId: integer('section_id').references(() => sections.id, { onDelete: 'set null' }),
  // The chapter this set is based on, sent as LLM grading context. Nullable — a set can stand alone.
  chapterDocumentId: integer('chapter_document_id').references(() => documents.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  // Optional excerpt shown to the student before the first question.
  passageText: text('passage_text'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, table => [
  index('idx_open_question_sets_subject').on(table.subjectId, table.isActive),
  index('idx_open_question_sets_section').on(table.sectionId)
])

export const openQuestions = sqliteTable('open_questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  setId: integer('set_id').notNull().references(() => openQuestionSets.id, { onDelete: 'cascade' }),
  promptText: text('prompt_text').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  // Editing a set soft-removes a question (like subjects/questions elsewhere) rather than
  // deleting the row outright, since open_question_attempts references it with onDelete:
  // 'restrict' to keep past transcripts intact even if the admin later edits the question list.
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, table => [
  index('idx_open_questions_set').on(table.setId, table.isActive)
])

// The per-"session" record the dashboards read — one per student per pass through a set,
// analogous to quiz_sessions. subjectId is denormalized for the same reason
// quiz_session_questions.subjectId is, to keep dashboard queries simple.
export const openQuestionSetAttempts = sqliteTable('open_question_set_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  setId: integer('set_id').notNull().references(() => openQuestionSets.id, { onDelete: 'restrict' }),
  studentId: integer('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'restrict' }),
  status: text('status', { enum: ['in_progress', 'completed'] }).notNull().default('in_progress'),
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at')
}, table => [
  index('idx_oq_set_attempts_student').on(table.studentId, table.startedAt),
  index('idx_oq_set_attempts_set').on(table.setId, table.studentId)
])

// One per student per open_question — the conversation for a single question within a set attempt.
export const openQuestionAttempts = sqliteTable('open_question_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  setAttemptId: integer('set_attempt_id').notNull().references(() => openQuestionSetAttempts.id, { onDelete: 'cascade' }),
  openQuestionId: integer('open_question_id').notNull().references(() => openQuestions.id, { onDelete: 'restrict' }),
  studentId: integer('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // 'needs_review' means the round cap was hit without an 'acceptable' verdict — the admin
  // reviews the transcript by hand. This is the signal the dashboards treat as correct/incorrect.
  status: text('status', { enum: ['in_progress', 'acceptable', 'needs_review'] }).notNull().default('in_progress'),
  roundCount: integer('round_count').notNull().default(0),
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at')
}, table => [
  uniqueIndex('idx_oq_attempts_set_attempt_question').on(table.setAttemptId, table.openQuestionId),
  index('idx_oq_attempts_student').on(table.studentId)
])

// One row per round within an open_question_attempt's conversation: the prompt shown (the
// original question for round 0, or the LLM's follow-up for round 1+), the student's answer,
// and the grading outcome.
export const openQuestionRounds = sqliteTable('open_question_rounds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  attemptId: integer('attempt_id').notNull().references(() => openQuestionAttempts.id, { onDelete: 'cascade' }),
  roundIndex: integer('round_index').notNull(),
  promptText: text('prompt_text').notNull(),
  studentAnswerText: text('student_answer_text'),
  // 'pending' until the student answers and grading is attempted; 'failed' if the Claude CLI
  // call errored (auth/CLI/unparseable output) — retryable without losing the typed answer.
  gradingStatus: text('grading_status', { enum: ['pending', 'graded', 'failed'] }).notNull().default('pending'),
  llmVerdict: text('llm_verdict', { enum: ['acceptable', 'needs_more_info'] }),
  llmFeedbackText: text('llm_feedback_text'),
  answeredAt: integer('answered_at'),
  gradedAt: integer('graded_at')
}, table => [
  uniqueIndex('idx_oq_rounds_attempt_index').on(table.attemptId, table.roundIndex)
])

// Single-row table (id is always 1) tracking whether the Claude CLI is currently authenticated,
// so the admin dashboard can show a re-auth banner instead of grading calls just failing silently.
export const claudeAuthStatus = sqliteTable('claude_auth_status', {
  id: integer('id').primaryKey(),
  status: text('status', { enum: ['ok', 'needs_reauth'] }).notNull().default('ok'),
  lastCheckedAt: integer('last_checked_at'),
  lastErrorMessage: text('last_error_message')
})
