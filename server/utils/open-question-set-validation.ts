import { z } from 'zod'

export const bodySchema = z.object({
  sectionId: z.number().int(),
  title: z.string().min(1).max(200),
  passageText: z.string().max(20000).nullable().optional(),
  // id present = update that existing question; omitted = insert a new one. Any existing
  // question not present here is soft-removed (isActive: false), never deleted outright, since
  // open_question_attempts references it with onDelete: 'restrict' to preserve transcripts.
  questions: z.array(z.object({
    id: z.number().int().optional(),
    promptText: z.string().min(1).max(2000)
  })).min(1)
})

export type OpenQuestionSetBody = z.infer<typeof bodySchema>
