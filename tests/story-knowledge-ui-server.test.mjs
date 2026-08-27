import test from "node:test";
import assert from "node:assert/strict";
import { knowledgeUIProjectionView } from "../api/_forest-projection-views.mjs";

function baseProjection() {
  return {
    world_id:"forest", source_sequence:42, projection_version:1,
    exposure:{by_world_fact:{
      WF_VISIBLE:{first_scene_id:"SCN_FOREST_L007_CORE",last_scene_id:"SCN_FOREST_L007_CORE"},
      WF_FUR:{first_scene_id:"SCN_FOREST_L025_CORE",last_scene_id:"SCN_FOREST_L025_CORE"},
    }},
    knowledge:{records:{
      visible:{knowledge_record_id:"KR_VISIBLE",record_kind:"observation",presentation_group:"observation",subject_ref:{type:"character",id:"fox"},subject_visibility:"hidden",display_state_key:"forest.obs.fur_snag",confidence:"SUSPECTED",source_world_fact_ids:["WF_FUR"],linked_record_ids:[],reconstruction_ids:[],first_created_sequence:4,last_changed_sequence:4},
      foxHidden:{knowledge_record_id:"KR_FOX",record_kind:"entity_history",presentation_group:"observation",subject_ref:{type:"character",id:"fox"},subject_visibility:"hidden",display_state_key:"fox.trace.fox_like",confidence:"LIKELY",source_world_fact_ids:["WF_VISIBLE"],linked_record_ids:["KR_VISIBLE"],reconstruction_ids:[],first_created_sequence:5,last_changed_sequence:9},
      internal:{knowledge_record_id:"KR_INTERNAL",record_kind:"observation",presentation_group:"internal",subject_ref:{type:"character",id:"fox"},subject_visibility:"hidden",display_state_key:"internal.fox",confidence:"CONFIRMED",source_world_fact_ids:[]},
    }},
    relationships:{
      cat:{identity_known:true,acquainted:true,borrowed_perspective:{seen:true,voluntarily_used:true},milestones:{understanding_established:true,reciprocity_established:false,cooperation_established:false,temporary_alliance_completed:false,relationship_synthesis_completed:false,companion:false},evidence:{understanding_event_ids:["e1"],reciprocity_event_ids:[],cooperation_event_ids:[],shared_history_event_ids:["e1","e2"]},unresolved_question_keys:["secret"]},
      owl:{identity_known:true,acquainted:true,borrowed_perspective:{seen:true,voluntarily_used:false},milestones:{understanding_established:false,reciprocity_established:false,cooperation_established:false,temporary_alliance_completed:false,relationship_synthesis_completed:false,companion:false},evidence:{understanding_event_ids:[],reciprocity_event_ids:[],cooperation_event_ids:[],shared_history_event_ids:[]}},
      fox:{identity_known:true,acquainted:true,borrowed_perspective:{seen:false,voluntarily_used:false},milestones:{understanding_established:true,reciprocity_established:true,cooperation_established:false,temporary_alliance_completed:false,relationship_synthesis_completed:false,companion:false},evidence:{understanding_event_ids:["x1"],reciprocity_event_ids:["x2"],cooperation_event_ids:[],shared_history_event_ids:["x3"]},unresolved_question_keys:["identity"]},
    },
    synthesis:{first_companion:null},
  };
}

test("knowledge UI strips hidden subject identity and internal records", () => {
  const view = knowledgeUIProjectionView(baseProjection());
  assert.equal(view.knowledge.records.length, 2);
  assert.equal("subject_ref" in view.knowledge.records[0], false);
  assert.equal(view.knowledge.records.some(r => r.display_state_key === "internal.fox"), false);
  assert.deepEqual(view.knowledge.records.find(r => r.knowledge_record_id === "KR_VISIBLE").provenance.scene_ids, ["SCN_FOREST_L025_CORE"]);
});

test("relationship UX never exposes Fox before player-facing identity reveal", () => {
  const view = knowledgeUIProjectionView(baseProjection());
  assert.ok(view.relationships.cat);
  assert.ok(view.relationships.owl);
  assert.equal(view.relationships.fox, undefined);
  assert.equal(JSON.stringify(view).includes("unresolved_question_keys"), false);
  assert.equal(JSON.stringify(view).includes("event_ids"), false);
  assert.equal(view.relationships.cat.shared_history_count, 2);
});

test("revealed Fox record unlocks relationship presentation without friendship score", () => {
  const p = baseProjection();
  p.knowledge.records.foxHidden.presentation_group = "character";
  p.knowledge.records.foxHidden.display_state_key = "character.fox";
  p.knowledge.records.foxHidden.subject_visibility = "revealed";
  const view = knowledgeUIProjectionView(p);
  assert.equal(view.relationships.fox.presentation_group, "character");
  assert.equal(view.knowledge.records.find(r => r.knowledge_record_id === "KR_FOX").subject_ref.id, "fox");
  assert.equal(JSON.stringify(view).includes("friendship"), false);
});
