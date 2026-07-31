/** Ordered full-product Playwright smokes (servers must already be up). */
export const ALL_FEATURE_SMOKES = Object.freeze([
  'e2e/slice-e-smoke.mjs',
  'e2e/slice-f-smoke.mjs',
  'e2e/slice-g-smoke.mjs',
  'e2e/slice-h-smoke.mjs',
  'e2e/slice-i-smoke.mjs',
  'e2e/slice-j-smoke.mjs',
  'e2e/slice-k-smoke.mjs',
  'e2e/slice-l-smoke.mjs',
  // AZ P0: Canon binder list scroll survives Back at 68 sheets (focus must not fight F1).
  'e2e/binder-scroll-restore-smoke.mjs',
])

/**
 * D4: the Canon propose form is a collapsed disclosure at every width.
 * Fields are not interactable until the summary is activated, so smokes must open it first.
 * Clicks the real summary control (no `details.open` poke) so the smoke also proves the affordance.
 */
export async function openProposeEditor(graph) {
  const disclosure = graph.locator('details.graph__editor--disclosure')
  await disclosure.waitFor({ timeout: 10000 })
  if (!(await disclosure.evaluate((el) => el.open))) {
    await disclosure.locator('summary').click()
  }
  await graph.locator('.graph__editor select').first().waitFor({ state: 'visible', timeout: 10000 })
  return disclosure
}

/**
 * ~2000-word dogfood chapter for UI e2e manuscript fills.
 * Keeps Aria/Kael + sealed-archive beats so fixture Review/Craft stay deterministic.
 */
export const NOVEL_CHAPTER = `
Aria stopped at the iron threshold and counted her breaths the way the archive wardens had taught apprentices who still believed rules were a kind of mercy. The corridor behind her held the last honest daylight she would see for hours. Ahead, the sealed stacks exhaled cold paper, dust, and the faint metallic tang of wards that had outlived the people who set them. Kael waited outside with his sword loose in the sheath, not drawn, not hidden. He had argued once already that a door which refused ordinary hands might still answer a blade. Aria had answered that some doors remembered violence longer than they remembered names.

She pressed her palm to the plate. No resistance met her skin. No warning chime. No polite refusal from the old binding. The seal simply accepted her as if she had always belonged on the wrong side of the law. That should have comforted her. It did not. Comfort was a story other people told when the room still had windows.

Inside, shelves rose like cliff faces. Each bay was labeled in three hands: the original cataloguer's neat ink, a wartime clerk's impatient slash, and a third script no living archivist claimed. Aria had come for a single folio on controlled access customs, the dull administrative heart of every empire that ever pretended knowledge was neutral. She told herself she wanted precedent. She wanted language strong enough to hold a council to its own promises. What she wanted, if she were cruelly honest, was proof that someone before her had walked into a locked room and left with both the truth and their own name intact.

Her blue eyes adjusted slowly. Lanterns along the central aisle woke in sequence, not bright, only willing. The light made amber motes of dust look almost warm. She thought of the last description anyone had written of her in an official file: eye color amber, temperament difficult, usefulness conditional. Files lied with the calm of furniture. She had stopped correcting them in rooms where correction became evidence.

Kael’s shadow crossed the threshold and stopped, obedient to the line she had drawn with a look. “If the door loved you that much,” he called, soft enough that the stacks would not take offense, “it may love your enemies the same.”

“Then we leave before they learn the trick,” Aria said, and did not look back.

She found the reading table by memory more than map. The archive’s public plans omitted this chamber the way polite histories omit the cost of their adjectives. A blotter still held the ghost of someone else’s notes. Aria set down her satchel, rolled her sleeves, and opened the first casebook. The prose was dry enough to sand wood: request schedules, witness requirements, the difference between custody and care. In the margins, a later reader had written one useful sentence: Access is not a door. Access is a relationship that can be revoked without changing the lock.

That line would matter. She copied it in her own hand, then kept reading because the work refused to be only a slogan.

Hours thinned. She learned how the old council had invented emergency seals during a famine of trust, how each emergency had been extended by letter rather than debate, how a temporary measure became architecture. She learned the names of clerks who had refused unlawful retrievals and vanished from payrolls within a season. She learned that courage in a bureaucracy often looked like missing ink.

When her neck stiffened, she stood and walked the aisle between family histories and maritime ledgers. The archive did not care which grief belonged to which shelf. A child’s primer leaned against a treatise on siege engines. Someone had once loved both enough to carry them through fire. Aria rested her fingertips on a spine stamped with a crest she almost recognized from Kael’s stories of the river houses, then took her hand away. Curiosity without a warrant was how people became footnotes in other people’s trials.

A soft scrape at the far end of the chamber made her still. Not footsteps. Paper shifting under its own weight, or a ward testing its joints. She waited until the sound settled into the ordinary life of a room that believed it was alone. Then she returned to the table and opened the second casebook.

This one concerned bloodlines and testimony. Who could speak for a sealed holding. Who could inherit a key without inheriting the crime attached to it. Parent and child appeared again and again as legal fictions before they appeared as people. Aria thought of every family tree drawn to make a claim look inevitable. Ink made cousins out of convenience. Ink made strangers out of inconvenient children. If she ever mapped those ties in the open, she would need edges that stayed pending until a human being accepted them. The archive had taught her that much without meaning to: a relationship drawn too early became a weapon.

She wrote another note. Rival houses share corridors before they share tables. The sentence felt true and unfinished. Truth that arrived finished was usually theater.

Outside, Kael shifted his weight. She could not see him, but the quality of the silence changed when he stopped pretending to be furniture. He would not enter unless the seal failed or she called. That was the bargain. He kept the hallway human. She kept the room from becoming a grave with better lighting.

Aria found, at last, the folio she had pretended was her only errand. Controlled archive access customs. Citations in three languages. A principle from a body that called itself a council on the keeping of memory: researchers may request; custodians may refuse; no refusal should be invisible. She read the surrounding commentary twice. The elegant part was the principle. The operative part was the paperwork that made refusal expensive. She smiled without softness. Idealism survived longer when it came with forms.

She pinned the citation in her mind the way she pinned useful scraps in a field journal. Later she would decide whether it belonged in private notes or in a proposal toward the lore sheet that was not yet brave enough to be canon. Canon was a door you only opened on purpose.

A draft moved through the high vents. Lanterns dipped and recovered. In that brief dimness Aria saw, or thought she saw, a second reading lamp lit at a table deeper in the stacks. When full light returned, the lamp was dark and the table bare. She did not walk toward it. Some invitations were just the room asking whether you were the sort of visitor who mistook fear for a clue.

Instead she packed. Casebooks closed with the humility of objects that had outlasted opinions. She left the blotter as she had found it. On her own paper she had enough to start a fight in committee and perhaps enough to prevent one in a corridor. That balance was the job.

At the threshold the seal released her as gently as it had admitted her. Kael’s eyes flicked over her face, inventorying damage that was not visible. “Well?” he asked.

“No resistance,” Aria said. “Which is either mercy or a mistake someone will charge interest on.”

He huffed, almost a laugh. “You always did prefer enemies who file.”

They walked. The outer hall restored sound in layers: boots, distant carts, a clerk arguing with a hinge. Aria kept the folio’s best sentence where she could reach it without unfolding paper. Access is a relationship. She could work with that. She could build review upon it, craft pressure upon it, even ask a research panel to chase the living citation instead of a rumor dressed as certainty.

Near the public stair a pair of apprentices hurried past with empty satchels and full fear. Aria stepped aside. One of them had ink on her fingers the precise blue of cheap official paste. The other wore a river-house pin askew. Neither looked at Kael’s sword. People who had not yet been hurt often failed to see the shape of hurt waiting in ordinary metal.

“You could still walk away from the council hearing,” Kael said when the stair had swallowed the apprentices. “Take the notes. Burn the performance.”

“If I walk away, the seal keeps loving the next person who should not be loved by it,” Aria answered. “I am not noble. I am unwilling to be surprised twice by the same door.”

They came out under a sky the color of watered ink. City noise resumed its claim on the senses. Somewhere below the archive hill, market voices sold fruit with the same confidence archives sold permanence. Aria tasted dust at the back of her throat and welcomed it. Dust meant she had been in a real room among real residue, not in a vision arranged by a clever enemy.

She stopped at the low wall overlooking the river and set her satchel down between her feet. Kael stood upwind, giving her the choice of speech. For a while she only watched barges shoulder along the current. Families worked those decks in knots of habit: parent at the tiller, child on rope, partner calling angles. From height the pattern looked clean. Up close it would be frayed, funny, fierce. Any graph of those lives that pretended otherwise would be a lie with nicer geometry.

“I need two things before evening,” she said finally. “A clean chapter of what happened, written like prose instead of testimony, and a list of every name the folio treats as authority. If a name cannot carry a citation, it does not enter the sheet.”

Kael nodded once. “I can fetch the secondary indexes from the annex.”

“Do not break their door.”

“I break doors only when they pretend they are morals,” he said, and this time the laugh arrived complete.

Aria began the chapter in her head before she reached for paper, because the first telling had to survive her own later edits. She had entered a sealed archive. She had met no resistance. She had left unchanged in the ways a body measures change, and altered in the ways a duty measures it. That paradox would annoy a reviewer looking for clean pressure. Good. Annoyance was a form of attention. Craft could work with attention. Continuity could argue with the color of her eyes in some careless line and she would accept the mark if it were earned, reject the proposal if it tried to become canon without her hand.

She wrote on the wall-top with stiff fingers, not caring that the wind worried the page. Sentence by sentence the chamber returned: iron threshold, willing lanterns, the third script no one claimed, the principle that refusal must remain visible. She wrote Kael outside the seal because he had chosen the colder post. She wrote the absent second lamp because omitting fear would make the courage look cheap. She did not write a triumph. Triumph was for people who needed the room to applaud.

When the page filled, she flexed her hand and kept going. A novel’s chapter, if it were honest, would not end when the protagonist cleared the door. It would end when the door had finished teaching. The lesson was still unfolding in her wrists and in the dull administrative anger blooming under her ribs. She would take that anger into committee and translate it into procedure. Procedure was how private fury became public safety without demanding saints.

Kael returned sooner than expected, a slim index volume under his arm and a scuff on his boot that suggested a conversation with a threshold. He offered no story. She offered no lecture. They had done this dance long enough to know which silences were load-bearing.

Together they descended toward the quarter where rented rooms pretended to be homes. Street printers shouted early editions. A broadsheet claimed the council would open all seals for the public good by winter. Aria bought a copy with a coin she resented and folded it beside her genuine folio. Counterfeit hope belonged in the file too. Later, under better light, she would compare the broadsheet’s citations to the archive’s and mark every ornamental reference that pointed nowhere. Research without that cruelty was only sightseeing.

At the lodging-house table she spread her materials in clean rectangles: chapter draft, folio, index, broadsheet, blank proposal slips. The slips would remain blank until a human decision filled them. That was not superstition. That was the only way she knew to keep a story from writing its readers without consent.

Kael unbuckled the sword and set it within reach but out of the narrative center of the table. “Read me the part where the door fails to be a door,” he said.

Aria read. Hearing the lines aloud exposed vanity and vagueness. She cut both. She kept the dust, the willing lanterns, the sentence about relationships and locks. She kept her blue eyes in one deliberate place so that if continuity ever argued amber, the argument would have a fair target. She did not smooth the hourlessness of the stacks into false clocks. Readers who needed every page stamped with mechanical time could read ledgers.

By the time the chapter approached two thousand words, her voice had gone rough and the room had gone dim with ordinary evening. She stopped not because an ideal length had been achieved, but because the next paragraph would begin a different movement: council, consequence, the social graph of who owed whom a refusal. That belonged tomorrow.

She signed the draft with initials only. Initials were enough for a document that still had to survive friends.

“Unchanged,” Kael said, tasting her earlier word.

“Unchanged where it would reassure people who were not there,” Aria replied. “Elsewhere, not at all.”

He accepted that. Outside, the river pushed on as if archives and councils were weather. Inside, the page cooled. Aria flexed ink-stained fingers and felt, with a clarity that almost hurt, the shape of the work ahead: review the chapter for pressure that never arrived, research the living citation until it could be pinned, propose lore only when it deserved a human accept, map rival and kin without turning pending guesses into edges, export what was solid, and refuse to let any helpful machine apply a sentence to the manuscript as if ownership were a feature.

She stacked the pages, aligned the corners, and placed her palm flat on the finished chapter the way she had once placed it on the seal. No resistance. Only paper, and the long labor of keeping paper honest.
`.trim()
