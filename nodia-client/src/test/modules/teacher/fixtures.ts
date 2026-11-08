import type { Plan } from "../../../modules/teacher/infrastructure/schemas";

/** Synthetic plan fixture; never imported by production code. */
export const planFixture: Plan = {
  id: "fixture-plan", revision_no: 1, state: "draft", content_hash: "a".repeat(64),
  outline: { schema_version: 1, title: "Networks fixture", topic: "Networks", objective: "Explain DNS", explanation_language: "en", organization: "topics", day_count: null,
    sections: [{ id: "s1", title: "DNS", required: true, prerequisite_section_ids: [], objectives: [{ id: "o1", description: "Explain resolution" }], units: [{ id: "u1", title: "DNS", objective_ids: ["o1"], day_start: null, day_end: null }] }],
    assessment_policy: { version: "teacher-assessment/1", practice_counts: { single_choice: 3, completion: 1, short_text: 1 }, final_counts: { single_choice: 6, completion: 2, short_text: 4 }, diagnostic_counts: { single_choice: 4, completion: 2, short_text: 2 }, final_threshold_percent: 90, coverage_per_objective: 2, criterion_ids: ["objective", "accuracy", "clarity"], normalization: "NFC-trim-collapse" },
  },
};
