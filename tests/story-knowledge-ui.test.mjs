import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../js/narrative/story-knowledge-ui.js", import.meta.url), "utf8");

function runtime(contract) {
  const sandbox = { console, setInterval(){ return 0; }, clearInterval(){}, SolivocWorldContent:{ async loadManifest(){return {runtimeFiles:["data/knowledge-ui.json"]};}, async loadRuntimeFile(){return contract;} } };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename:"story-knowledge-ui.js" });
  return sandbox.SolivocForestKnowledgeUI;
}

const contract = {
  schemaVersion:1, worldId:"forest", packageVersion:"0.03", uxContractVersion:"forest-knowledge-ui@1",
  groups:[
    {id:"observation",label:"Наблюдения",empty:"empty"},
    {id:"character",label:"Персонажи",empty:"empty"},
    {id:"companion",label:"Спутники",empty:"empty"},
  ],
  confidence:{SUSPECTED:"Предположение",LIKELY:"Вероятно",INFERRED:"Вывод",CONFIRMED:"Подтверждено"},
  kindLabels:{observation:"Наблюдение",entity_history:"История"},
  characters:{cat:{name:"Кот",avatar:"cat.svg"},owl:{name:"Сова",avatar:"owl.svg"},fox:{name:"Лис",avatar:"fox.svg"}},
  relationship:{acquaintedLabel:"Знакомство",milestones:[
    {key:"understanding_established",label:"Понимание"},{key:"reciprocity_established",label:"Взаимность"},
    {key:"cooperation_established",label:"Сотрудничество"},{key:"temporary_alliance_completed",label:"Временный союз"},
    {key:"relationship_synthesis_completed",label:"Синтез отношений"},{key:"companion",label:"Спутник"},
  ]},
  definitions:[
    {id:"KR_OBS",kind:"observation",group:"observation",displayStateKey:"forest.obs.fur_snag",title:"Рыжеватая шерсть"},
    {id:"KR_CAT",kind:"entity_history",group:"character",displayStateKey:"character.cat",title:"Кот"},
    {id:"KR_CAT_COMP",kind:"entity_history",group:"companion",displayStateKey:"companion.cat",title:"Кот"},
  ],
};

test("knowledge UI contract preserves three canonical groups and semantic confidence", () => {
  const ui = runtime(contract);
  assert.equal(ui.validateContract(contract).ok, true);
  assert.equal(contract.groups.map(g=>g.id).join(","), "observation,character,companion");
  assert.deepEqual(Object.keys(contract.confidence), ["SUSPECTED","LIKELY","INFERRED","CONFIRMED"]);
});

test("model renders earned relationship milestones without a friendship score", () => {
  const ui = runtime(contract);
  const projection = {
    source_sequence:10,
    knowledge:{records:[{knowledge_record_id:"o1",record_kind:"observation",presentation_group:"observation",display_state_key:"forest.obs.fur_snag",confidence:"SUSPECTED",provenance:{scene_ids:["SCN_FOREST_L025_CORE"]}}]},
    relationships:{cat:{presentation_group:"character",acquainted:true,borrowed_perspective:{seen:true,voluntarily_used:true},milestones:{understanding_established:true,reciprocity_established:false,cooperation_established:false,temporary_alliance_completed:false,relationship_synthesis_completed:false,companion:false},shared_history_count:2}},
    synthesis:{first_companion:null},
  };
  const model = ui.buildModel(projection, contract);
  assert.equal(model.groups.observation[0].title, "Рыжеватая шерсть");
  assert.equal(model.groups.character[0].type, "relationship");
  assert.deepEqual(Array.from(model.groups.character[0].earned, x => x.label), ["Понимание"]);
  assert.equal(JSON.stringify(model).includes("friendship"), false);
});

test("companion presentation replaces character relationship group instead of duplicating it", () => {
  const ui = runtime(contract);
  const projection = {
    knowledge:{records:[{knowledge_record_id:"cat-root",record_kind:"entity_history",presentation_group:"companion",display_state_key:"companion.cat",confidence:"CONFIRMED",provenance:{}}]},
    relationships:{cat:{presentation_group:"companion",acquainted:true,borrowed_perspective:{seen:true,voluntarily_used:true},milestones:{understanding_established:true,reciprocity_established:true,cooperation_established:true,temporary_alliance_completed:true,relationship_synthesis_completed:true,companion:true},shared_history_count:7}},
    synthesis:{first_companion:"cat"},
  };
  const model = ui.buildModel(projection, contract);
  assert.equal(model.groups.character.length, 0);
  assert.equal(model.groups.companion.filter(x => x.type === "relationship").length, 1);
  assert.equal(model.groups.companion.filter(x => x.displayStateKey === "companion.cat").length, 0);
});
