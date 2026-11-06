import { explainableQuestionId } from '../../../../../utils/session-question-access'
import { getExplanationState } from '../../../../../utils/question-explanations'

export default defineEventHandler(async (event) => {
  return getExplanationState(await explainableQuestionId(event))
})
