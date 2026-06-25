import { apiFetch } from './api';

export const fetchComments = (runId)       => apiFetch(`/api/activities/${runId}/comments`);
export const postComment   = (runId, body) => apiFetch(`/api/activities/${runId}/comments`, {
  method: 'POST',
  body:   JSON.stringify({ body }),
});
export const deleteComment = (commentId)   => apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' });
