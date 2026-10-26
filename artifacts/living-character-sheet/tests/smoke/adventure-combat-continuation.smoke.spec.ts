import { expect, test } from "@playwright/test";

test("[smoke:adventure] enemy stats, confirmed attack story and member End Turn", async ({ page }) => {
  test.slow();
  await page.addInitScript(() => localStorage.setItem("@lcs_app_settings", JSON.stringify({ showDevLandingDemoContent: true })));
    const member={id:'player',partyCode:'TEST-42',characterName:'Lyra Shadowstep',characterClass:'Monk',currentHp:52,maxHp:57,tempHp:0,armorClass:16,conditions:[]};
    const economy={actionsUsed:0,bonusActionsUsed:0,reactionUsed:false,movementUsed:0};
    const state={code:'TEST-42',schemaVersion:1,stateRevision:4,environmentTurnId:'environment',currentTurnIdByBattle:{battle:'player'},currentTurnId:'player',battleTurnOrderById:{battle:['player','wolf']},turnOrder:['player','wolf'],initiative:[],activeMemberIds:['player'],participantBattleById:{player:'battle',wolf:'battle'},combatNpcs:[{id:'wolf',name:'Shadow Creature',sourceType:'manual',disposition:'hostile',coreStats:{speed:30,initiativeBonus:1,strength:12,dexterity:12,constitution:12,intelligence:8,wisdom:10,charisma:8},visibleStatKeys:[],dummyState:{currentHp:20,maxHp:30,armorClass:10,actionUsed:false},conditions:[],createdAt:new Date().toISOString()}],rollRequests:[],lootAssignments:[],noteAssignments:[],restRequests:[],eventLog:[],playerEconomyByMember:{player:economy},updatedAt:new Date().toISOString()};
    let turnCalls=0;
    await page.route('**/api/**',async route=>{
      const url=route.request().url(), body=route.request().postDataJSON();let data: unknown={ok:true};
      if(url.endsWith('/members'))data={code:'TEST-42',members:[member]};
      else if(url.endsWith('/combat-state'))data=state;
      else if(url.endsWith('/economy/spend')){economy.actionsUsed=1;state.stateRevision++;data={ok:true,economy};}
      else if(url.endsWith('/combat/apply-outcomes')){const target=body.targetResults[0];state.combatNpcs[0].dummyState.currentHp=Math.max(0,20+target.hpDeltaPreview);state.stateRevision++;data={ok:true,appliedCount:1,replayed:false,targetResults:[{requestIndex:0,targetId:'wolf',targetType:'npc',status:'applied'}]};}
      else if(url.endsWith('/end-turn')){turnCalls++;if(body.memberId!=='player'||body.battleId!=='battle'||body.isDmOverride)throw Error('Wrong end-turn authority');state.currentTurnIdByBattle.battle='wolf';state.currentTurnId='wolf';state.stateRevision++;}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    });

  await page.goto("/landing", { timeout: 90_000 });
  await page.getByText("Try demo character (Lyra Shadowstep)").click();
  await expect(page).toHaveURL(/\/(tabs)?\/?$/);
    await page.evaluate(()=>{
      localStorage.setItem('@party_session',JSON.stringify({partyCode:'TEST-42',memberId:'player'}));
      localStorage.setItem('party-member-token.v1:TEST-42:player','test-fixture-token');
      localStorage.setItem('@ai_dm_oneoff_active_session_v1:workspace-qa',JSON.stringify({entries:[{id:'player-start',role:'player',text:'I face the creature.'}],pendingChoices:[],prologueDone:true}));
    });
    await page.goto('/adventure/session/workspace-qa?title=Sunken%20Temple', {timeout:60000});
    await page.getByTestId('adventure-workspace').waitFor({timeout:60000});
    await page.getByText('HP 20/30 · AC 10',{exact:true}).waitFor({timeout:30000});
    await page.getByLabel('Open combat actions',{exact:true}).click();
    const use=page.getByRole('button',{name:/Use .* attack/}).first();
    await use.scrollIntoViewIfNeeded();
    // Manual d20 fixes the fixture outcome; primary damage remains the explicit-click roll.
    const input=page.getByLabel(/d20 attack roll/).first();await input.fill('18');
    await use.click();
    await page.getByText('Action confirmed for 1 target(s).',{exact:true}).waitFor({timeout:30000});
    const narrative=page.getByTestId('workspace-narrative');
    await narrative.getByText(/Lyra Shadowstep attacks Shadow Creature with/).waitFor({timeout:30000});
    if(state.combatNpcs[0].dummyState.currentHp>=20)throw Error('HP not updated in fixture');
    await page.getByRole('button',{name:'End your turn',exact:true}).click();
    await page.getByText("Shadow Creature's turn",{exact:true}).first().waitFor({timeout:30000});
    if(turnCalls!==1)throw Error('Wrong end-turn count');
});
