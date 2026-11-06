import { explainableQuestionId } from '../../../../../utils/session-question-access'
import { requestExplanation } from '../../../../../utils/question-explanations'

// Starts Claude on an explanation if there isn't one yet (or the last attempt failed); returns
// straight away with the current state — the page polls the GET until it's done.
export default defineEventHandler(async (event) => {
  return requestExplanation(await explainableQuestionId(event))
})
