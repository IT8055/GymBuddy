export type ExerciseType = 'reps' | 'timed' | 'target'

/** A step in a repetition routine, run in order during Workout Mode. */
export type RepStep =
  | { kind: 'warmup'; secs: number }
  | { kind: 'cooldown'; secs: number }
  | { kind: 'rest'; secs: number }
  | { kind: 'set'; reps: number }

/** A user-defined figure captured at the end of a timed/target exercise. */
export interface Metric {
  label: string
  unit?: string
}

export interface Exercise {
  id: number
  user_id?: number
  name: string
  description: string | null
  machine_number: string | null
  type: ExerciseType
  equipment_settings: string | null
  unit: string | null

  // Reps type
  reps_per_minute: number | null
  default_weight: number | null
  steps: RepStep[] | null

  // Timed type
  default_duration_secs: number | null

  // Target type
  target_value: number | null
  target_label: string | null

  // Timed + Target: which extra metrics to capture at the end (user-defined)
  metrics: Metric[] | null

  archived?: number
  created_at?: string
}

export interface WorkoutItem extends Exercise {
  exercise_id: number
  position: number
}

export interface Workout {
  id: number
  name: string
  description: string | null
  items: WorkoutItem[]
  created_at?: string
}

export interface SetResult {
  exercise_id: number
  set_number: number
  reps?: number | null
  weight?: number | null
  distance?: number | null
  duration_secs?: number | null
  calories?: number | null
  effort?: number | null
  comments?: string | null
  // Custom metric values keyed by label, e.g. { "Floors climbed": 30 }
  extras?: Record<string, number> | null
  recorded_at?: string
  // joined fields when reading
  exercise_name?: string
  exercise_type?: ExerciseType
  unit?: string | null
}

export interface Ambient {
  temp_c?: number
  humidity?: number
  weather?: string
  lat?: number
  lon?: number
}

export interface SessionPayload {
  client_uid: string
  workout_id: number | null
  started_at: string
  ended_at: string | null
  comments: string | null
  sets: SetResult[]
  ambient?: Ambient | null
}

export interface SessionSummary {
  id: number
  workout_id: number | null
  workout_name: string | null
  started_at: string
  ended_at: string | null
  comments: string | null
  set_count: number
  exercise_count?: number
}

export interface User {
  id: number
  email: string
  created_at?: string
}
