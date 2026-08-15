// AUTHORED CONTENT for the multi-book seed (Ash II / Vosk / Halen).
// New content ONLY; imported by seed.ts. Book I data lives in seed.ts and is
// untouched. Types come from seed.ts to keep one source of truth.
import type { SeedEntry, SeedChapter } from "./seed";

// New Book II entries ONLY (Book I entries reused by existing id in ties).
export const ASH2_ENTRIES: SeedEntry[] = [
  {
    id: "ash2-corin",
    kind: "character",
    name: "Corin Sarn",
    no: "05",
    note: "returned",
    summary:
      "Halvard\u2019s elder brother, struck from the ledger twelve years back and long counted among the drowned. He walks into Kirn on a low water in the first week of the new year, dry to the knee, and asks after the empty chair by its old name.",
  },
  {
    id: "ash2-chapterhouse",
    kind: "world",
    name: "The Chapter House",
    no: "14",
    note: "twenty-two chairs",
    summary:
      "The stone hall of the Quiet Sept above the harbour, where twenty-one readers sit among twenty-two chairs. The twenty-second was kept empty for a debt none would name, until the year Corin came back to sit in it.",
  },
  {
    id: "ash2-driftroll",
    kind: "lore",
    name: "The Drift Roll",
    no: "35",
    note: "the counter-ledger",
    summary:
      "The list the Sept keeps against Halvard\u2019s tide ledger: every name the harbourmaster strikes out, the Sept writes back in salt. Where the two rolls disagree, a reader is meant to trust the water.",
  },
  {
    id: "ash2-turnwater",
    kind: "lore",
    name: "The Turn of the Water",
    no: "36",
    note: "the ninth day",
    summary:
      "The single slack hour on the ninth day of a Long Ebb when the drowned quarter stands wholly clear and a salt-name may be answered aloud without being taken back. It comes once in a keeper\u2019s life, if it comes.",
  },
  {
    id: "ash2-tollbell",
    kind: "organization",
    name: "The Toll-Bell Watch",
    no: "24",
    note: "the ninth family",
    summary:
      "The families the Harbour Assembly does not count, who ring the drowned bell of Ashkeld from a boat at low water for anyone who will pay to be remembered. The Assembly calls them beggars; the Ferrier calls them by their names.",
  },
];

export const ASH2_FACTS: Array<[string, string, string, string]> = [
  ["k1", "ash2-corin", "Struck", "From the ledger, in the Long Ebb"],
  ["k2", "ash2-corin", "Returned", "New year, on a low water"],
  ["k3", "ash2-corin", "Kin", "Halvard\u2019s elder brother"],
  ["l1", "ash2-chapterhouse", "Chairs", "Twenty-two, one kept empty"],
  ["m1", "ash2-driftroll", "Kept by", "The Quiet Sept, against the tide ledger"],
  ["n1", "ash2-turnwater", "Occurs", "The ninth day of a Long Ebb, at slack"],
];

export const ASH2_TIES: Array<[string, string, string]> = [
  ["ash2-corin", "halvard", "brother"],
  ["ash2-corin", "longebb", "struck in"],
  ["ash2-corin", "ash2-chapterhouse", "claims the chair"],
  ["ash2-corin", "sept", "owed by"],
  ["halvard", "ash2-corin", "brother"],
  ["ash2-chapterhouse", "sept", "houses"],
  ["sept", "ash2-chapterhouse", "sits in"],
  ["ash2-driftroll", "sept", "kept by"],
  ["ash2-driftroll", "halvard", "answers"],
  ["idra", "ash2-driftroll", "keeps"],
  ["ash2-turnwater", "longebb", "measured from"],
  ["ash2-turnwater", "ashkeld", "clears"],
  ["maren", "ash2-turnwater", "waits for"],
  ["ash2-tollbell", "ashkeld", "rings"],
  ["ash2-tollbell", "assembly", "uncounted by"],
  ["ferrier", "ash2-tollbell", "rows for"],
  ["maren", "ash2-corin", "reads for"],
  ["maren", "ash2-driftroll", "checks"],
];

export const ASH2_CHAPTERS: SeedChapter[] = [
  {
    id: "ash2-ch1",
    number: 1,
    title: "A Dry Man",
    paragraphs: [
      "He came up the harbour steps at the turn of the year on a low water, an old man dry to the knee where any honest man off a boat is wet to the waist, and he asked the first person he met after the empty chair by the name no one in Kirn had said aloud in twelve years. The person he met was Maren, who had lit the Verge at four and was walking home along the wall where the salt still showed.",
      "She did not know him and she knew him at once, the way you know a face from a coin worn smooth. He had Halvard\u2019s jaw and none of Halvard\u2019s caution. When she said nothing he smiled as though her silence were an answer he had expected, and told her his name was Corin Sarn, and that he had come to sit down at last.",
      "Maren walked him to the harbourmaster\u2019s office because she did not know what else to do with a drowned man who would not stop talking. She left him at the door and did not go in. Behind her, in the locked room off the office, she heard the scratch of a pen go still.",
    ],
  },
  {
    id: "ash2-ch2",
    number: 2,
    title: "The Drift Roll",
    paragraphs: [
      "Sister Idra kept a roll the Assembly did not know she kept, and she showed it to Maren the morning after Corin came, which was the first time in two years she had looked her full in the face. It was a counter-ledger: every name Halvard struck from the tide roll, the Sept had written back in salt on the long wall of the archive, so that where the two disagreed a reader might weigh them.",
      "Forty-one names her uncle had struck, twelve years back, and forty on the Drift Roll to answer them. One short. Idra let her count it twice and did not help her, which was Idra\u2019s way of teaching a thing too heavy to be told.",
      "\u201CThe fortieth is Corin,\u201D Idra said at last, \u201Cand the water gave him back. The forty-first has no name on either roll, because your uncle struck it before it could be written.\u201D She rolled the archive shut. \u201CDo not ask me whose. Ask the wall on the ninth day, when it will not be able to take the answer back.\u201D",
    ],
  },
  {
    id: "ash2-ch3",
    number: 3,
    title: "Brother and Brother",
    paragraphs: [
      "Halvard would not speak to Corin and would not turn him out, so the two of them shared the office like two tides in one channel, and Maren carried the words neither would say to the other. It was old work, older than she was. She had counted forty-one names off her uncle\u2019s ledger once and said nothing; now she carried them across a room one at a time.",
      "\u201CHe was on the boat that did not come back,\u201D Halvard told her, meaning the boat he had offered her a berth on and she had refused. \u201CI struck him myself. A man does not un-strike his own brother without the ledger asking what else he lied to keep off it.\u201D He would not meet her eye. \u201CYou refused the berth. Be glad. The drowned quarter keeps what it is owed.\u201D",
      "Corin, for his part, asked only about the chair. He asked it the way a man asks after a debt he is certain of, patient, unbothered, dry to the knee. Maren began to understand that her uncle\u2019s silence and the empty chair and the one short name were the same arithmetic she had been standing inside since she was nineteen, and that Corin had come to make it balance.",
    ],
  },
  {
    id: "ash2-ch4",
    number: 4,
    title: "The Chair Claimed",
    paragraphs: [
      "The Quiet Sept keeps twenty-one members, never more and never fewer, and twenty-two chairs in the chapter house above the harbour. On the eighth day of the new year Corin Sarn walked into the hall uninvited and sat down in the chair that had no one, and twenty-one readers said nothing, because none of them could name the thing he had broken.",
      "Idra rose and argued, as she had argued once against Maren\u2019s oath, and as before she lost, though this time it was not the Sept that overruled her. It was the number itself. Twenty-one members and a body in the twenty-second chair makes twenty-two, and the Sept cannot be twenty-two, so one of them was no longer a member, and no reader would say which.",
      "Maren watched from the door where the students stand. She saw Idra sit back down and would not look at the chair, the same way she would not look at Maren the night of the oath. Some debts, Maren thought, are not paid. They are only moved into a different chair.",
    ],
  },
  {
    id: "ash2-ch5",
    number: 5,
    title: "The Toll-Bell",
    paragraphs: [
      "There is a bell in the drowned tower of Ashkeld that stands clear of the water only at the lowest ebbs, and there are families the Harbour Assembly does not count who row out to ring it for anyone who will pay to be remembered by name. The Assembly calls them beggars. The Ferrier, who rows for them, calls them by their names, which is more than the Assembly does for its own.",
      "Corin paid the Toll-Bell Watch to ring for the forty-first name, the one struck before it was written, and the Ferrier rowed him out past the Verge at low water while Maren kept the light and watched the black boat go where she had refused to go. The bell came back across the water thin and flat, one stroke, and then the tide climbed and took the tower again.",
      "Halvard heard it from the locked room and did not come out. Maren counted the stroke into the sum with all the rest. One bell for one name her uncle had spent twelve years keeping off two ledgers and out of one chair, and now the whole harbour had heard it rung, and could not un-hear it any more than she could un-read a wall.",
    ],
  },
  {
    id: "ash2-ch6",
    number: 6,
    title: "Nine Days Out",
    paragraphs: [
      "On the second day of that year the water began to go out and did not stop, and the old people of Kirn stood on the wall and counted, because the last time the water went out and did not stop it went for nine days and came back wrong, and forty-one drowned on its return. Maren counted with them and kept the Verge burning, which is what a keeper does whether the water is coming or going.",
      "Idra found her on the stair on the eighth night. \u201CThe turn of the water comes on the ninth day,\u201D she said, \u201Cone slack hour when the quarter stands wholly clear and a salt-name may be answered aloud and not taken back. It comes once in a keeper\u2019s life, if it comes. Your father waited for his and it did not come. Yours is tomorrow.\u201D",
      "\u201CWhose name,\u201D Maren said, and it was not a question, because she had known whose name was on the wall since the morning after the storm, two years and a book ago, and had told no one. Idra did not answer. She went down the stair into the dark, and left Maren the light and the ninth day and the sum still one name short.",
    ],
  },
  {
    id: "ash2-ch7",
    number: 7,
    title: "The Answer",
    paragraphs: [
      "The turn of the water came on the ninth day at the ebb, one slack hour, and the drowned quarter of Ashkeld stood wholly clear from the Verge to the last tower for the first time since before Maren was born. She went down to the wall where the salt showed white on grey stone, the same wall, the same name, legible for one turn of the water to anyone the Sept had taught to see.",
      "Corin stood beside her, dry to the knee, and Halvard came out of the locked room at last and stood on her other side, and neither brother would say the name. So Maren said it. She read it aloud off the wall in the one hour it could not be taken back, and it was her own, the name the tide had written before she was born, the forty-first, struck from the ledger by her uncle on the day of the Ebb so that she would live and not be counted among the drowned.",
      "The water turned then and began to climb, and the salt went under, and it did not come back up. Corin nodded once, the way a man nods when a debt is at last read out true, and walked down into the rising water toward the chair that was his again. Halvard did not stop him. Maren climbed the eleven fathoms of the Verge and lit it, because someone had to, and because she knew now the trick of the tallow was to keep burning after you have learned what the light was kept for.",
    ],
  },
];

export const VOSK_ENTRIES: SeedEntry[] = [
  {
    id: "vosk-sable",
    kind: "character",
    name: "Sable Cauth",
    no: "01",
    note: "lockwright",
    summary:
      "Lockwright of the Third Stair, licensed to raise and drop the water that lets a barge climb the Reach. Reads the river’s mood off the sluice-foam and trusts it further than she trusts the Guild that pays her.",
  },
  {
    id: "vosk-orrin",
    kind: "character",
    name: "Orrin Delph",
    no: "02",
    note: "gate-master",
    summary:
      "Gate-master of the Upper Locks and Sable’s master before the Reach jumped its old channel. Keeps the lock-tallies, and keeps off them the days the river moved without warning.",
  },
  {
    id: "vosk-wren",
    kind: "character",
    name: "Wren Ostley",
    no: "03",
    note: "bridge-ward",
    summary:
      "Bridge-ward of the Nine Spans, sworn to walk the bridges at every turn of the water and mark which still hold. Youngest ever given a ward-key, and reminded of it whenever a span goes down.",
  },
  {
    id: "vosk-thessaly",
    kind: "character",
    name: "Thessaly Marn",
    no: "04",
    note: "ward-mother",
    summary:
      "Ward-mother of the Spanwardens, who taught Wren the bridge-count and then voted to give her the Drowned Span, the one nobody walks twice.",
  },
  {
    id: "vosk-quillan",
    kind: "character",
    name: "Quillan Voss",
    no: "05",
    note: "channel-reader",
    summary:
      "Channel-reader for hire, banned from the Guild for charting the Reach’s next course before it moved. Sells maps of a river that has not yet decided where to run.",
  },
  {
    id: "vosk-reach",
    kind: "world",
    name: "Vosk Reach",
    no: "11",
    note: "river-city",
    summary:
      "An inland city built along a river that changes its course every few years. Its streets are laid where the water used to be, and half of them are wrong by the time the maps are printed.",
  },
  {
    id: "vosk-thirdstair",
    kind: "world",
    name: "The Third Stair",
    no: "12",
    note: "lock-flight",
    summary:
      "A flight of nine locks that lifts the river forty feet through the middle of Vosk. Barges climb it in a day if the water is willing and never if it is not.",
  },
  {
    id: "vosk-ninespans",
    kind: "world",
    name: "The Nine Spans",
    no: "13",
    note: "the bridges",
    summary:
      "The nine bridges that hold Vosk together when the river wanders beneath them. Eight are counted; the ninth is the Drowned Span, marked on no ward’s tally.",
  },
  {
    id: "vosk-locksguild",
    kind: "organization",
    name: "Guild of the Locks",
    no: "21",
    note: "keepers of the water",
    summary:
      "The order that owns the right to raise and lower the Reach. Nine lockwrights to a stair, and a rule that no wright may open a gate the Guild has not tallied.",
  },
  {
    id: "vosk-spanwardens",
    kind: "organization",
    name: "The Spanwardens",
    no: "22",
    note: "keepers of the bridges",
    summary:
      "Wardens sworn to walk the Nine Spans at every turn of the water and record which stand. They answer to no council, only to the count.",
  },
  {
    id: "vosk-turning",
    kind: "lore",
    name: "The Turning",
    no: "31",
    note: "when the river moves",
    summary:
      "The river’s habit of abandoning its bed and carving a new one, sometimes overnight. A city grows in the dry channel, and a Turning takes it back without asking.",
  },
  {
    id: "vosk-lockright",
    kind: "lore",
    name: "The Lock-Right",
    no: "32",
    note: "sworn at the Stair",
    summary:
      "The oath a lockwright swears at the foot of the Third Stair, to open no gate against the Guild’s tally and to drown no barge to save the water. There is no oath for what to do when the river disagrees with the tally.",
  },
];

export const VOSK_FACTS: Array<[string, string, string, string]> = [
  ["vf1", "vosk-sable", "Office", "Lockwright of the Third Stair"],
  ["vf2", "vosk-sable", "Sworn", "The Lock-Right, at the Stair"],
  ["vf3", "vosk-sable", "Hands", "Scarred left, from a gate that dropped early"],
  ["vf4", "vosk-orrin", "Office", "Gate-master of the Upper Locks"],
  ["vf5", "vosk-orrin", "Years", "Thirty at the water"],
  ["vf6", "vosk-wren", "Office", "Bridge-ward of the Nine Spans"],
  ["vf7", "vosk-wren", "Ward", "The Drowned Span"],
  ["vf8", "vosk-wren", "Age", "Twenty-two"],
  ["vf9", "vosk-thessaly", "Office", "Ward-mother of the Spanwardens"],
  ["vf10", "vosk-thirdstair", "Locks", "Nine, in one flight"],
  ["vf11", "vosk-thirdstair", "Lift", "Forty feet"],
  ["vf12", "vosk-ninespans", "Bridges", "Nine, one uncounted"],
  ["vf13", "vosk-locksguild", "Wrights", "Nine to a stair"],
  ["vf14", "vosk-turning", "Last", "Four years back, the Reach jumped east"],
];

export const VOSK_TIES: Array<[string, string, string]> = [
  ["vosk-sable", "vosk-orrin", "trained by"],
  ["vosk-sable", "vosk-thirdstair", "keeps"],
  ["vosk-sable", "vosk-locksguild", "sworn to"],
  ["vosk-sable", "vosk-lockright", "sworn"],
  ["vosk-sable", "vosk-quillan", "buys maps from"],
  ["vosk-orrin", "vosk-sable", "master of"],
  ["vosk-orrin", "vosk-locksguild", "gate-master of"],
  ["vosk-orrin", "vosk-turning", "survived"],
  ["vosk-wren", "vosk-thessaly", "taught by"],
  ["vosk-wren", "vosk-spanwardens", "sworn to"],
  ["vosk-wren", "vosk-ninespans", "wards"],
  ["vosk-thessaly", "vosk-spanwardens", "ward-mother of"],
  ["vosk-thessaly", "vosk-wren", "gave the Drowned Span"],
  ["vosk-quillan", "vosk-locksguild", "banned by"],
  ["vosk-quillan", "vosk-turning", "charts"],
  ["vosk-reach", "vosk-turning", "moved by"],
  ["vosk-reach", "vosk-ninespans", "held by"],
  ["vosk-reach", "vosk-thirdstair", "climbed by"],
  ["vosk-thirdstair", "vosk-locksguild", "kept by"],
  ["vosk-ninespans", "vosk-spanwardens", "walked by"],
  ["vosk-locksguild", "vosk-thirdstair", "owns"],
  ["vosk-spanwardens", "vosk-ninespans", "counts"],
  ["vosk-turning", "vosk-reach", "remakes"],
  ["vosk-lockright", "vosk-locksguild", "administered by"],
];

// book-vosk-1 — protagonist: Sable Cauth (lockwright, the water)
export const VOSK1_CHAPTERS: SeedChapter[] = [
  {
    id: "vosk1-ch1",
    number: 1,
    title: "The Tally and the Foam",
    paragraphs: [
      "Sable Cauth had kept the Third Stair for six years, and in six years she had learned to read the sluice-foam the way Orrin read the tally: as a thing that told you the truth before the paper did. That morning the foam ran the wrong way, curling back on itself at the fourth gate, and the tally in her hand said the water was flat and biddable.",
      "She stood at the gatehead with a barge waiting below her and a choice she was not licensed to make. The Guild’s rule was plain. No wright opens a gate the tally has not counted, and the tally counted this water calm. But the foam was not calm, and the foam had never lied to her.",
      "She opened the third gate a hand’s width against the tally, let the wrong water bleed off, and only then raised the fourth. The barge climbed clean. When the master below tipped his cap to her she did not tip hers back, because she was already writing, in a book that was not the Guild’s, what the foam had said that the tally did not.",
    ],
  },
  {
    id: "vosk1-ch2",
    number: 2,
    title: "Orrin’s Ledger",
    paragraphs: [
      "The Upper Locks were Orrin Delph’s and had been for thirty years, and in thirty years the man had never once let Sable see the pages he kept for the days the Reach moved on its own. She had been his prentice long enough to know the drawer existed and long enough to know better than to ask after it.",
      "She asked after it anyway, the week the foam and the tally fell out of true. He told her the ledger was the gate-master’s to keep and the water was the wright’s to raise, and that a wright who wanted to keep her Lock-Right did not go reading in a master’s drawer.",
      "That night she counted the Turnings she could remember and found four, and found the gaps between them shrinking, and understood that Orrin had been keeping a second ledger because the first one had stopped being true. She did not say so. She had learned from him that some water is safer left un-tallied.",
    ],
  },
  {
    id: "vosk1-ch3",
    number: 3,
    title: "The Map That Hadn’t Happened",
    paragraphs: [
      "Quillan Voss sold maps of the Reach as it would run, not as it ran, and the Guild had banned him for it because a map of a river that has not yet moved is either fraud or prophecy and the Guild could not afford to learn which. Sable bought one from him under the Second Span, coin in a folded glove.",
      "The map showed the river east of its bed, cutting a new channel clean through the granary quarter, and it showed the Third Stair standing in dry ground with no water to lift. She asked him how he knew. He said he did not know, he only read, the same as she read foam, and that the reading did not care whether the Guild had licensed it.",
      "She kept the map inside her coat for a week before she compared it to the wrong-running foam at the fourth gate. They agreed. She had bought a thing she could not un-know, and she had bought it, she understood, the way you take on a debt you were never asked to carry.",
    ],
  },
  {
    id: "vosk1-ch4",
    number: 4,
    title: "Against the Tally",
    paragraphs: [
      "The Lock-Right is sworn at the foot of the Third Stair, to open no gate against the tally and to drown no barge to save the water, and there is no clause in it for the day the tally is wrong and a barge is in the lock and the river is already turning beneath the stone. Sable met that day in the fourth year, on an ordinary autumn shift with the water half-raised.",
      "The tally said hold. The foam said the channel below was emptying, that the Reach was pulling east even as she stood there, and that a barge held in a lock with no water beneath it would settle onto the sill and break its back. She had one gate she was allowed to open and one she was not.",
      "She opened the one she was not. She dropped the whole flight against the tally and rode the barge down on the last of the falling water, and it grounded soft in mud where the river had been an hour before. She had saved the barge and broken her oath in the same motion, and Orrin, watching from the gatehead, wrote nothing down at all.",
    ],
  },
  {
    id: "vosk1-ch5",
    number: 5,
    title: "The Dry Stair",
    paragraphs: [
      "By the next morning the Reach had gone east, exactly where Quillan’s map had drawn it, and the Third Stair stood in dry ground with nine locks and no water to lift. Sable walked the empty flight from top to bottom, her boots loud on stone that had never once been dry in six years of her keeping.",
      "The granary quarter was a channel now, its cellars running full, its people gone up to the high streets with what they could carry. The Guild sent no word. A stair with no river is a stair with no wright, and a wright with no stair is a woman the tally has stopped counting.",
      "She stood at the foot of the dry Stair where she had sworn the Lock-Right and understood that the oath had been to the water, not to the Guild, and that the water had left. Whatever she was now, she would have to swear it to herself.",
    ],
  },
  {
    id: "vosk1-ch6",
    number: 6,
    title: "The Second Ledger",
    paragraphs: [
      "Orrin gave her the drawer the week the Guild moved the wrights east to build a new stair on the new channel. He did it without ceremony, sliding the second ledger across the gatehead table and telling her it was hers now, because he was too old to keep counting a river that would not stay counted.",
      "The pages went back thirty years. Every Turning the tally had missed, every gate opened against the count to save a barge or a bridge, every wright before her who had read the foam over the paper and kept the reading secret. She was not the first to break the Lock-Right. She was only the first to be handed the proof.",
      "She asked him why he had never shown it to the Guild. He said the Guild sold the tally, and a tally that could be wrong was a tally no one would buy, and so the Guild would rather drown a barge than admit the water had a mind. Then he told her to go and read her river, and she went, carrying two ledgers now, the Guild’s and the true one.",
    ],
  },
  {
    id: "vosk1-ch7",
    number: 7,
    title: "The New Channel",
    paragraphs: [
      "The new stair was half-built on the eastern channel when Sable came to it with the second ledger under her coat and the Guild’s tally in her hand. The foam at its first gate ran wrong already, the same backward curl, and the tally beside it said calm.",
      "She stood at the gatehead the way she had stood six years before, a barge below and a choice she was not licensed to make. This time she did not hesitate over the gate. She hesitated over the ledger.",
      "She set the Guild’s tally down on the stone and left it there, and opened the gate to the foam and not the paper. The barge climbed clean. Below her the new city was already laying streets in the dry old bed, wrong the day they were drawn, and she watched them the way you watch a debt you know will come due, and lit no lamp, because a lockwright keeps water, not light.",
    ],
  },
];

// book-vosk-2 — protagonist: Wren Ostley (bridge-ward, the spans) — parallel, not a series
export const VOSK2_CHAPTERS: SeedChapter[] = [
  {
    id: "vosk2-ch1",
    number: 1,
    title: "The Count",
    paragraphs: [
      "Wren Ostley walked the Nine Spans at every turn of the water and marked which still held, because that was the whole of a bridge-ward’s oath and the whole of what kept Vosk from coming apart. Eight bridges she counted and eight she marked, and the ninth she did not, because the ninth was the Drowned Span and no ward marked that one twice.",
      "She was twenty-two and the youngest ward ever given a key, and she was reminded of both facts every time a span dropped a foot in the night and had to be shored before dawn. The river moved under the bridges the way weather moves over a field, and a ward’s count was the only warning the city had.",
      "That morning the Fourth Span rang under her boot like a struck bell, a sound bridges make just before they don’t. She marked it holding, because it was, and she wrote beneath the mark the hour and the note that it had rung, and she carried the sound home with her the way you carry a name you have read and can’t give back.",
    ],
  },
  {
    id: "vosk2-ch2",
    number: 2,
    title: "The Drowned Span",
    paragraphs: [
      "Thessaly Marn had taught Wren the bridge-count and then, at the vote, given her the Drowned Span, the one bridge on the Nine that no tally showed and no ward walked twice. It was the ninth bridge and it was under water more years than not, and the wardens kept it off the count so the city would not ask why they kept it at all.",
      "Wren walked it once, at low water, as every ward walked it once and never again. It stood in the old channel the river had left four years back, its arches choked with silt, its keystones carved with names worn past reading. She counted nine arches and marked none of them.",
      "She asked Thessaly why a bridge no one used was still warded. Thessaly said the Nine Spans were nine, not eight, and a count that dropped the drowned one to make the number tidy was a count that had started lying. A ward’s whole trade, she said, was refusing to make the number tidy.",
    ],
  },
  {
    id: "vosk2-ch3",
    number: 3,
    title: "The Ward-Key",
    paragraphs: [
      "The ward-key opened the shoring-lockers on every span, the boxes of wedge and chain a ward used to hold a bridge through a turn of the water until the lockwrights could drop the level beneath it. Wren had been given the key at twenty and had not yet been made to choose which of two failing bridges to spend it on.",
      "She was made to choose the night the Fourth and the Sixth rang in the same hour. She had one key, one set of lockers, and the time to shore one bridge before the water finished with the other. The Fourth carried the granary road. The Sixth carried nothing but the way to the Drowned Span.",
      "She shored the Sixth. She could not have said why, only that the way to the drowned bridge felt like a thing the city could not afford to lose even though it had already decided it had. The Fourth came down at dawn with no one on it, and the wardens marked it lost, and Wren marked, beside the loss, that she had chosen the road to the bridge that was not counted.",
    ],
  },
  {
    id: "vosk2-ch4",
    number: 4,
    title: "The Span That Fell",
    paragraphs: [
      "A bridge-ward swears to walk the Nine Spans and mark the count true and to shore what can be shored and abandon what cannot, and there is no line in the oath for standing on a span while it goes down. Wren met that line on the Second, in the fourth year, at an ordinary turn of the water with the river running east where it had no business running.",
      "The Second rang and kept ringing, which bridges do not do, and she was at its middle with the ward-key in her hand and the lockers a full span away. She could run for the lockers and reach them after the bridge was gone, or she could run for the bank and mark the Second lost while she still had feet to run on.",
      "She ran for the bank. She reached it as the middle went, the arch she had stood on folding into the new channel without a sound, and she turned and marked the Second lost with her hand still shaking. Thessaly, watching from the Third, said nothing, because there was nothing in the count to say. The number was eight now, and the count did not lie about that.",
    ],
  },
  {
    id: "vosk2-ch5",
    number: 5,
    title: "Eight Spans",
    paragraphs: [
      "With the Second gone, Vosk had eight bridges to hold it together and a river that had chosen a new bed straight through the granary quarter, and the two halves of the city reached each other now only by the spans that still stood. Wren walked all eight at every turn and marked them, and felt the count grow heavier by one absence.",
      "The wardens spoke of building again where the Second had stood, but the lockwrights had gone east to a new stair and the water there was not yet tallied, and no one builds a span across a river still deciding where to run. So the city waited, halved, on eight bridges and a ward’s count.",
      "Wren walked the Drowned Span again, which no ward did twice, because the drowned bridge stood in the dry old channel now and the dry old channel was the only ground firm enough to build on. She counted its nine arches a second time and understood that the bridge no one used might be the only one the city could still afford.",
    ],
  },
  {
    id: "vosk2-ch6",
    number: 6,
    title: "Thessaly’s Vote",
    paragraphs: [
      "Thessaly Marn called the vote to raise the Drowned Span back into the count, to make it the ninth again in truth and not only in the wardens’ stubbornness, and she called it knowing the city would rather have a tidy eight than an inconvenient nine. Wren sat in the ward-house and watched the ward-mother spend thirty years of standing on a single count.",
      "The wardens argued that the drowned bridge was silt and worn stone and names no one could read, and Thessaly said that was precisely why it was warded, because a city that forgot its drowned crossings forgot which way its river used to run. A ward who kept only the bridges in use, she said, was a ward who had stopped counting and started agreeing.",
      "The vote gave Wren the Drowned Span for a second time, to survey and shore and raise, which no ward had ever been asked to do twice. Thessaly would not look at her afterward, and Wren understood that she had been handed the one bridge the wardens had spent forty years agreeing to forget.",
    ],
  },
  {
    id: "vosk2-ch7",
    number: 7,
    title: "The Ninth Arch",
    paragraphs: [
      "Wren came to the Drowned Span at low water with the ward-key and the shoring-chains and the whole count of the Nine Spans in her book, eight standing and one to raise. The old channel was dry around it and the new river ran a quarter-mile east, loud enough to hear from the ninth arch.",
      "She cleared the silt from the first keystone and read the name carved there, worn but not past reading if you knew how the wardens cut their letters, and it was a name she had not expected. She read it twice to be certain, with the dry channel around her boots, and then she cut a fresh mark beside it: the ninth span, warded, holding.",
      "She did not tell the ward-house whose name was on the keystone. That was the arrangement, she was learning, the same arrangement that kept a drowned bridge on a count that pretended not to have it. She raised the ninth arch back into the number, and the city that had halved itself was whole again by one bridge no one had used, and Wren walked home across it counting nine.",
    ],
  },
];

export const HALEN_ENTRIES: SeedEntry[] = [
  {
    id: "halen-reyes",
    kind: "character",
    name: "Det. Ana Reyes",
    no: "31",
    note: "homicide detective",
    summary:
      "Homicide detective out of the Third Precinct, twelve years on the job and three off the wagon. Reads a room the way other people read a warrant, and trusts the rain more than she trusts a witness.",
  },
  {
    id: "halen-okonkwo",
    kind: "character",
    name: "Det. Samuel Okonkwo",
    no: "32",
    note: "reyes' partner",
    summary:
      "Reyes’ partner, six months out of Robbery and still keeping his shoes clean. Writes everything down, which Reyes finds either reassuring or damning depending on the week.",
  },
  {
    id: "halen-marsh",
    kind: "character",
    name: "Dr. Evelyn Marsh",
    no: "33",
    note: "county coroner",
    summary:
      "County coroner of Halen for nineteen years. Speaks to the dead more plainly than to the living, and has never signed a certificate she couldn’t defend under oath.",
  },
  {
    id: "halen-vance",
    kind: "character",
    name: "Capt. Gerald Vance",
    no: "34",
    note: "precinct captain",
    summary:
      "Captain of the Third. Came up under the old command and knows where every body in the department is buried, which is why he sleeps so poorly.",
  },
  {
    id: "halen-lacroix",
    kind: "character",
    name: "Toma Lacroix",
    no: "35",
    note: "informant",
    summary:
      "Runs numbers off the back booth of the Blue Comet diner and sells what he overhears to whoever pays in cash. Owes Reyes a favour he keeps trying to settle and never quite does.",
  },
  {
    id: "halen-delacroce",
    kind: "character",
    name: "Salvatore Delacroce",
    no: "36",
    note: "syndicate boss",
    summary:
      "Head of the Delacroce family, which owns the waterfront freight in everything but name. Never touches money, never signs a paper, and has outlived four district attorneys.",
  },
  {
    id: "halen-quill",
    kind: "character",
    name: "Rosa Quill",
    no: "37",
    note: "crime reporter",
    summary:
      "Crime desk at the Halen Ledger. Gets to the scene before the ambulance often enough that Vance keeps a file on how. Trades tips with Reyes in a currency of mutual suspicion.",
  },
  {
    id: "halen-doyle",
    kind: "character",
    name: "Frankie Doyle",
    no: "38",
    note: "the cold case",
    summary:
      "A dockhand who went into the harbour in the winter of the flood year and was ruled a drowning. The file was closed in a week and reopened only because Reyes could not leave a clean margin alone.",
  },
  {
    id: "halen-third",
    kind: "world",
    name: "The Third Precinct",
    no: "41",
    note: "station house",
    summary:
      "A soot-black station house on Verrin Street, radiators that knock like a witness and a basement archive no one has audited since the flood. Home to Halen Homicide.",
  },
  {
    id: "halen-glasswater",
    kind: "world",
    name: "Glasswater District",
    no: "42",
    note: "the waterfront",
    summary:
      "The old freight waterfront, all wet cobbles and sodium light, where the rain never seems to stop and the Delacroce cranes work a shift the city pretends not to see.",
  },
  {
    id: "halen-bluecomet",
    kind: "world",
    name: "The Blue Comet",
    no: "43",
    note: "all-night diner",
    summary:
      "An all-night diner three blocks off the precinct where cops, reporters, and men with reasons to stay awake share the same bad coffee under the same buzzing sign.",
  },
  {
    id: "halen-morgue",
    kind: "world",
    name: "County Morgue",
    no: "44",
    note: "the cold room",
    summary:
      "Sub-basement of the courthouse, tiled and cold and quiet. Marsh’s domain. The one room in Halen where nobody lies to your face.",
  },
  {
    id: "halen-family",
    kind: "organization",
    name: "The Delacroce Family",
    no: "51",
    note: "waterfront syndicate",
    summary:
      "The syndicate that runs the Glasswater freight, the numbers, and the quiet end of the longshoremen’s local. Old money laundered through wet money, patient as a tide.",
  },
  {
    id: "halen-homicide",
    kind: "organization",
    name: "Halen Homicide Bureau",
    no: "52",
    note: "the squad",
    summary:
      "Nine detectives and one clearance rate the commissioner keeps in a drawer. Works out of the Third and closes what the city will let it close.",
  },
  {
    id: "halen-floodyear",
    kind: "lore",
    name: "The Flood Year",
    no: "61",
    note: "the winter of the water",
    summary:
      "The winter the seawall failed and Glasswater went under for nine days. Case files drowned with the basement, and half of Halen’s official history has a nine-day hole in it.",
  },
  {
    id: "halen-ninthbullet",
    kind: "lore",
    name: "The Ninth Bullet",
    no: "62",
    note: "an accounting",
    summary:
      "Squad-room shorthand for a killing that leaves one round more than the story allows. When the count doesn’t close, an old Halen detective says there’s a ninth bullet somewhere.",
  },
];

export const HALEN_FACTS: Array<[string, string, string, string]> = [
  ["hf1", "halen-reyes", "Rank", "Detective, Homicide"],
  ["hf2", "halen-reyes", "Years on job", "Twelve"],
  ["hf3", "halen-reyes", "Sidearm", "Standard-issue revolver, six rounds"],
  ["hf4", "halen-okonkwo", "Prior post", "Robbery"],
  ["hf5", "halen-okonkwo", "Habit", "Writes every word down"],
  ["hf6", "halen-marsh", "Office", "County Coroner, nineteen years"],
  ["hf7", "halen-marsh", "Rule", "Signs nothing she can’t defend"],
  ["hf8", "halen-vance", "Rank", "Captain, Third Precinct"],
  ["hf9", "halen-delacroce", "Standing", "Head of the Delacroce family"],
  ["hf10", "halen-delacroce", "Method", "Never signs, never touches cash"],
  ["hf11", "halen-doyle", "Ruling", "Accidental drowning"],
  ["hf12", "halen-doyle", "When", "The Flood Year"],
  ["hf13", "halen-floodyear", "Duration", "Nine days under water"],
  ["hf14", "halen-ninthbullet", "Meaning", "One round more than the story allows"],
  ["hf15", "halen-lacroix", "Post", "Back booth, the Blue Comet"],
];

export const HALEN_TIES: Array<[string, string, string]> = [
  ["halen-reyes", "halen-okonkwo", "partner"],
  ["halen-reyes", "halen-homicide", "detective in"],
  ["halen-reyes", "halen-lacroix", "runs informant"],
  ["halen-reyes", "halen-doyle", "reopened"],
  ["halen-okonkwo", "halen-homicide", "detective in"],
  ["halen-okonkwo", "halen-reyes", "partner"],
  ["halen-marsh", "halen-morgue", "presides over"],
  ["halen-marsh", "halen-doyle", "autopsied"],
  ["halen-vance", "halen-third", "commands"],
  ["halen-vance", "halen-homicide", "oversees"],
  ["halen-lacroix", "halen-bluecomet", "works out of"],
  ["halen-lacroix", "halen-family", "overhears"],
  ["halen-delacroce", "halen-family", "heads"],
  ["halen-delacroce", "halen-glasswater", "controls"],
  ["halen-quill", "halen-reyes", "trades tips with"],
  ["halen-quill", "halen-homicide", "covers"],
  ["halen-doyle", "halen-glasswater", "worked the docks"],
  ["halen-doyle", "halen-floodyear", "died during"],
  ["halen-third", "halen-glasswater", "polices"],
  ["halen-homicide", "halen-third", "housed in"],
  ["halen-family", "halen-glasswater", "owns"],
  ["halen-floodyear", "halen-glasswater", "drowned"],
  ["halen-ninthbullet", "halen-homicide", "squad lore of"],
];

export const HALEN1_CHAPTERS: SeedChapter[] = [
  {
    id: "halen1-ch1",
    number: 1,
    title: "Rain on the Glasswater",
    paragraphs: [
      "The call came in at 4:10, which in Halen meant the rain had been falling long enough to wash most of the evidence into the storm drains before anyone thought to look. Reyes took it standing at the window of the Third with a cold cup in her hand, watching the sodium lamps of the Glasswater District smear themselves across the wet glass.",
      "The body was a man, face-down on the freight cobbles between two Delacroce cranes, one shoe gone and the other still laced tight. No wallet, no watch, and a single entry wound that the rain had rinsed clean as a confession. Okonkwo crouched beside it with his notebook already out, writing down the things the rain hadn’t taken yet.",
      "“Robbery gone wrong,” said the uniform who’d called it in, because that was the sentence that let everyone go home. Reyes looked at the laced shoe and the missing one and didn’t answer him. A man who fought hard enough to lose a shoe did not stand still to be robbed.",
      "She had Okonkwo photograph the laces from four angles before the meat wagon came. Then she stood a while longer in the rain, letting it soak through her coat, because a scene told you more when you stopped hurrying it.",
    ],
  },
  {
    id: "halen1-ch2",
    number: 2,
    title: "The Cold Room",
    paragraphs: [
      "Marsh had him on the table by seven, the tiled cold of the county morgue swallowing every sound but the drip of the tap she never quite closed. She worked the way she always did, narrating to the dead as though they might correct her.",
      "“One round,” she told Reyes, holding it to the light with a pair of forceps. “Small calibre, close range, upward angle. Whoever did this was shorter than your man, or kneeling, or your man was already down.” She set it in the steel dish with a sound like a coin dropped on a counter.",
      "Reyes asked the question she always asked, and Marsh gave the answer she always gave, which was that time of death was a guess dressed as a fact and she would put nine that morning to eleven the night before, no closer. But the stomach contents put him at the Blue Comet inside the last hour of his life.",
      "It was the coffee that did it. Nobody drank the Blue Comet’s coffee unless they were waiting for someone, and nobody waited on the Glasswater at midnight unless the someone frightened them more than the rain.",
    ],
  },
  {
    id: "halen1-ch3",
    number: 3,
    title: "Back Booth, Blue Comet",
    paragraphs: [
      "Lacroix was in the back booth where he was always in the back booth, a coffee going cold in front of him as an alibi for the hours he spent there. He saw Reyes come in out of the rain and his face did the small arithmetic of a man deciding how much he owed and to whom.",
      "“I don’t know him,” he said, before she’d shown the photograph. Reyes put it on the table anyway, face-up beside his cup, and watched the lie leave his eyes the way steam leaves coffee. He knew him. He’d served him. He’d watched him wait.",
      "For the price of the favour he still owed her, Lacroix gave up a name and a time. The dead man had come in at eleven, sat two booths down, and left with a second man who never took his hat off and never touched the coffee he ordered. Delacroce money moved like that, Lacroix said. Quiet, and never touching what it paid for.",
      "Reyes left him the photograph and a warning to lock his door. On the way out she noticed the second cup at the dead man’s booth had never been cleared, and the ring it left on the table was still faintly damp.",
    ],
  },
  {
    id: "halen1-ch4",
    number: 4,
    title: "The Captain’s Drawer",
    paragraphs: [
      "Vance called her in before she’d finished the paper, which told Reyes the case had already climbed higher than a dockside robbery had any right to climb. His office smelled of old smoke and older favours, and he did not offer her a chair.",
      "“Let it be a robbery,” he said, not quite an order and not quite a plea. He’d come up under the old command, and the old command had learned to survive the Delacroce family by learning where not to look. He knew where every body in the department was buried because he had helped choose some of the graves.",
      "Reyes laid out the round, the angle, the untouched coffee, the second man in the hat. Vance listened with the tired patience of a man hearing a story he already knew the ending of, and when she finished he opened his drawer, looked at whatever he kept in there, and closed it again without taking anything out.",
      "“You’ll want to be sure,” he said finally, “because the family doesn’t bury a mistake. It buries the man who made it.” It was not a no. Reyes had worked for him long enough to know that from Vance, not a no was the most dangerous kind of yes.",
    ],
  },
  {
    id: "halen1-ch5",
    number: 5,
    title: "Six Rounds and One",
    paragraphs: [
      "The dead man had a name now, pulled off a print the rain hadn’t reached: a bookkeeper for one of the Delacroce freight fronts, three weeks from testimony he’d agreed to give and then, apparently, decided not to. His apartment had been cleaned with the thoroughness of people who did this for wages.",
      "But they had missed one thing, because everyone always missed one thing. Taped behind the toilet cistern, wrapped in oilcloth, was a service revolver with six rounds in the cylinder and a seventh loose in the cloth beside it, as though someone had loaded in a hurry and dropped one.",
      "Okonkwo wrote it all down, then said the thing that made Reyes go still. The round Marsh pulled from the body matched nothing this revolver could fire. So the bookkeeper had armed himself against someone, and the someone had shot him with a different gun entirely, and the seventh round was an accounting that didn’t close.",
      "“The ninth bullet,” Reyes said, and Okonkwo, being six months out of Robbery, had to ask what that meant. It meant, she told him, that somewhere in this the count was wrong, and a wrong count in Halen was never an accident. It was a message left for whoever was patient enough to add.",
    ],
  },
  {
    id: "halen1-ch6",
    number: 6,
    title: "The Man in the Hat",
    paragraphs: [
      "Rosa Quill found Reyes before Reyes found the man in the hat, which was Quill’s particular talent and Reyes’ particular headache. She had a photograph of her own, taken outside the Blue Comet by a stringer, of a man leaving at midnight with his hat brim low and his hands in his pockets like a man who’d just set something down.",
      "They traded, the way they always did, in a currency of mutual suspicion. Quill gave up the photo and the plate of the car that had waited for him. Reyes gave up nothing she couldn’t afford and let Quill believe it was more. The plate came back to a shell company that came back to the Glasswater freight that came back, of course, to the family.",
      "The man in the hat was Delacroce muscle, but muscle didn’t choose its own targets, and a bookkeeper three weeks from the stand chose himself. Someone had told the hat where to wait. Someone with the bookkeeper’s trust and the family’s ear both.",
      "Reyes looked at the photograph a long time. The hat hid the face, but not the hands, and the hands were doing something she recognised: turning something over and over, small and metal, the way a man does when he is waiting to be paid and does not trust the man who owes him.",
    ],
  },
  {
    id: "halen1-ch7",
    number: 7,
    title: "What the Rain Kept",
    paragraphs: [
      "She found him at the end where the Glasswater cobbles ran down into the harbour, under the last of the Delacroce cranes, in the same rain that had never once stopped since the case began. He had his hat off now, and his hands were empty, and he was waiting for her the way a man waits for a bill he always knew would come.",
      "It hadn’t been Delacroce who ordered it, he told her, and Reyes believed him because a man that tired had run out of reasons to lie. It had been someone inside the family who wanted the testimony to disappear and the blame to land on the family itself, so the family would be too busy bleeding to notice the knife. The bookkeeper had been a message. So, nearly, had he.",
      "Reyes wrote it down in Okonkwo’s notebook because her own hands weren’t steady, the account closing at last, the ninth bullet found. Not a bullet at all, it turned out. A name, one more than the story allowed, sitting in the family’s own books where only a bookkeeper would have thought to hide it.",
      "The rain kept falling on the Glasswater as they walked him up the cobbles to the car. It had washed the first scene clean and it would wash this one too, and in a week the storm drains would have taken every trace that any of it had happened. But Reyes had the notebook, and the count was closed, and in Halen that was as near to justice as the weather allowed.",
    ],
  },
];

export const HALEN2_CHAPTERS: SeedChapter[] = [
  {
    id: "halen2-ch1",
    number: 1,
    title: "A Clean Margin",
    paragraphs: [
      "The file was thin the way only a closed file gets thin, and it was the thinness that bothered Reyes more than any thickness could have. Frankie Doyle, dockhand, went into the harbour in the Flood Year and came out ruled a drowning, and the whole of his death fit on four pages with a clean white margin nobody had ever written in.",
      "She had pulled it by accident, or told herself she had, reaching past it in the basement archive for something else and finding her hand had stopped on it instead. Four pages. One week from body to closed. In the Flood Year, when the basement itself was under water and half of Halen’s history drowned with it, a case that closed in a week was not efficient. It was buried.",
      "Okonkwo asked why she cared about a twelve-year-old drowning, and Reyes gave him the only answer that was true, which was that she could not leave a clean margin alone. Somebody had gone to the trouble of making this death simple. Simple deaths in Halen were the expensive kind.",
      "She signed the file out under her own name, which the desk sergeant noted with the small raised eyebrow of a man logging something he expected to be asked about later. Reyes let him. If someone came asking, she wanted to know who.",
    ],
  },
  {
    id: "halen2-ch2",
    number: 2,
    title: "The Coroner Remembers",
    paragraphs: [
      "Marsh had signed the certificate herself, twelve years younger and seven years into the job, and she remembered it the way she remembered all of them, which was completely and without comfort. She did not need the file. She recited it back to Reyes across the cold room like a woman reading her own handwriting off the inside of her eyes.",
      "“Drowning,” she said, “is a diagnosis of exclusion. You call it drowning when you’ve ruled everything else out. And in the Flood Year I ruled nothing out, because the water was in my basement and the bodies were coming in faster than I could tell them apart.” She said it flatly, the way she said everything, but her hand was flat on the steel table as she said it.",
      "There had been a mark, she remembered. A bruise at the base of the skull she had noted and then, under a pressure she would not name even now, had described in the certificate as consistent with the harbour rocks. Consistent. The most honest dishonest word in the language.",
      "“I signed what I could defend,” Marsh said, “and I have never signed one since that I couldn’t. This is the one. If you’re going to open it, open it all the way, because I’m too old to be half-sorry.”",
    ],
  },
  {
    id: "halen2-ch3",
    number: 3,
    title: "The Flood Year",
    paragraphs: [
      "To understand Frankie Doyle you had to understand the nine days the seawall failed, and to understand those you had to talk to people who did not want to be found talking about them. The Flood Year had drowned Glasswater and, conveniently, a great deal of paper that certain families preferred underwater.",
      "Reyes worked it the slow way, the archive way, matching the four pages of Doyle’s file against the harbourmaster’s salvage logs and the union rolls that had survived on higher ground. Doyle had been a longshoreman in the Delacroce local, which in the Flood Year meant he had been standing on the exact stretch of waterfront where the most paper drowned.",
      "He had also, the union rolls showed, filed a grievance three days before the wall failed, alleging that freight was moving off the docks that appeared on no manifest. A dockhand who counted what he wasn’t supposed to count, in the week before a flood conveniently erased the count.",
      "The grievance itself was gone, of course, drowned with everything else. But the fact of it had been logged in a single line in a ledger that had spent nine days above the waterline, and one line was all Reyes needed to know that Frankie Doyle had not simply fallen in.",
    ],
  },
  {
    id: "halen2-ch4",
    number: 4,
    title: "Twelve Years of Silence",
    paragraphs: [
      "Lacroix did not want to talk about the Flood Year, which was itself an answer. He had been younger then, closer to the docks, and the things he had overheard in that winter were the things he had learned it was safest never to have heard. He turned his cold coffee in its ring of damp and would not look at the photograph of Doyle.",
      "“You’re asking me to remember a man everybody agreed to forget,” he said. “That agreement kept a lot of people breathing.” But he owed Reyes, still, the favour he could never quite settle, and she let the weight of it sit on the table between them until he spoke.",
      "Doyle had been asking questions on the docks in the days before the water came, Lacroix said, about freight that arrived at night and left before the manifests were written. He had asked them of the wrong man. And when the wall failed and the water rose, the wrong man had seen, in nine days of chaos, an opportunity that no ordinary week would ever have offered him.",
      "“Nobody killed Frankie Doyle,” Lacroix said, and then, because the truth was crawling out of him whether he liked it or not, “the flood killed him. Somebody just made sure he was in the water when it came.”",
    ],
  },
  {
    id: "halen2-ch5",
    number: 5,
    title: "The Name Above the Waterline",
    paragraphs: [
      "The salvage log was the thing that survived, and the salvage log was the thing that hanged him. Twelve years on, in the dry upper archive that the flood had never reached, Reyes and Okonkwo laid the pages out and matched the hand that had signed for Doyle’s recovered effects against the hands on every other paper from that week.",
      "It was the same hand. The man who had logged Doyle’s body out of the water had also logged, three days earlier, a freight consignment that appeared on no manifest and no grievance, because the grievance had drowned. He had been the wrong man Doyle asked. He had been the one with the opportunity. And he had signed his own name, twelve years ago, in the confidence of someone who knew the paper would drown.",
      "Except it hadn’t. It had spent nine days above the waterline in a harbourmaster’s office on the high ground, and it had waited twelve years in a dry drawer for a detective who could not leave a clean margin alone.",
      "Okonkwo read the name aloud and then went quiet, because the name was not a stranger’s. It was a name that still drew a pension from the city, a name that had retired with a commendation, a name that had once, in the old command, worked out of the Third.",
    ],
  },
  {
    id: "halen2-ch6",
    number: 6,
    title: "The Old Command",
    paragraphs: [
      "Vance did not pretend surprise, which was its own kind of confession. He had come up under the old command, and the old command had a way of closing files that thinned them to four clean pages, and he had known for twelve years which of his own the salvage log would name if anyone ever bothered to read it.",
      "“He was a good police once,” Vance said, and it was not a defence so much as an epitaph. The man had been Delacroce money’s eyes inside the Third in the Flood Year, and when a dockhand counted freight that shouldn’t have existed, the eyes had seen the flood coming and used it. A drowning in a drowning. The perfect place to hide a body was in a hundred other bodies.",
      "Reyes asked why he had let it stay buried, and Vance gave her the truest thing he had ever given her, which was that burying it had felt, at the time, like protecting the badge, and every year since it had felt more like protecting the wrong man, until the two were indistinguishable and he was too far in to tell them apart.",
      "He opened his drawer, and this time he took something out of it: the original certificate, Marsh’s first draft, the one that said the bruise at the base of the skull was not consistent with anything the harbour rocks could do. He had kept it twelve years. He had, Reyes understood, been waiting for someone to make him hand it over.",
    ],
  },
  {
    id: "halen2-ch7",
    number: 7,
    title: "Effects, Recovered",
    paragraphs: [
      "They brought him in on a grey morning with the rain finally, briefly, stopped, an old man now with a commendation on his wall and a pension in the bank and twelve years of clean margins behind him. He did not fight it. Men who bury a thing that long, Reyes had learned, are half-waiting to be dug up.",
      "Marsh amended the certificate with a steadiness that had cost her twelve years to earn back, the diagnosis of exclusion at last excluding the right thing. Homicide, she wrote, and signed it, and this time she could defend it all the way. Frankie Doyle, dockhand, who had counted what he was not supposed to count, was a murder again instead of a misfortune.",
      "Quill got the story, because Quill always got the story, and Reyes gave her more of it than she strictly had to, because a thing buried this long deserved to be said out loud where the whole city could hear it. The Ledger ran it under the fold, which was as much justice as a twelve-year-old drowning could expect against a living family and a dead flood.",
      "Reyes closed the file last of all, in the basement archive where she had found it, and left the clean white margin exactly as clean as before, because now it did not need writing in. The account was closed. Somewhere above her the rain started again on the Glasswater, patient as it had always been, and she let it fall on someone else’s scene for once, and went home.",
    ],
  },
];
