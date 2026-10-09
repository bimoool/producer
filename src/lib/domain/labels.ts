export const DECLARATION_STATUS = {
  done: "выполнено",
  in_progress: "в процессе",
  partial: "частично",
  not_done: "не выполнено",
} as const;
export type DeclarationStatus = keyof typeof DECLARATION_STATUS;
export const UNCONFIRMED = "Требует подтверждения";

export const TASK_STATUS = {
  todo: "К выполнению",
  in_progress: "В работе",
  blocked: "Заблокирована",
  done: "Готово",
} as const;
export type TaskStatus = keyof typeof TASK_STATUS;

export const TASK_PRIORITY = { high: "Высокий", normal: "Обычный", low: "Низкий" } as const;
export type TaskPriority = keyof typeof TASK_PRIORITY;

export const GOAL_STATUS = {
  active: "Активна",
  done: "Достигнута",
  paused: "На паузе",
  dropped: "Отменена",
} as const;
export type GoalStatus = keyof typeof GOAL_STATUS;
