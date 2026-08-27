import type {
  DisputeOrder,
  DisputeStatus,
  DisputeType,
  ResolutionOutcome,
  TimelineStep,
} from "@/types/disputes";

/** Deterministic date offset helper (no Date.now / Math.random anywhere). */
function plus(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

const escalationDetail: Record<DisputeType, string> = {
  dispute: "transition/auto-escalate-dispute — operator review required",
  declined_dispute:
    "transition/auto-escalate-declined-dispute — seller declined, operator review required",
  replacement:
    "transition/auto-escalate-replacement — replacement request pending fulfilment",
};

const resolutionLabel: Record<ResolutionOutcome, string> = {
  buyer: "Resolved in buyer's favor — refund issued",
  seller: "Resolved in seller's favor — payout released",
  replacement: "Replacement issued to buyer",
};

type Seed = {
  n: number;
  tx: string;
  buyer: [name: string, handle: string];
  seller: [name: string, handle: string];
  listing: string;
  amount: number;
  payout: number;
  type: DisputeType;
  status: DisputeStatus;
  reason: string;
  message: string;
  placed: string;
  shipped?: string;
  delivered?: string;
  opened: string;
  escalated: string;
  updated: string;
  resolution?: { outcome: ResolutionOutcome; resolvedAt: string; actor: string };
};

function mk(s: Seed): DisputeOrder {
  const id = `do-${String(s.n).padStart(2, "0")}`;
  const timeline: TimelineStep[] = [
    {
      id: `${id}-placed`,
      kind: "order",
      label: "Order placed",
      detail: `${s.buyer[0]} purchased "${s.listing}" for a payin of $${s.amount.toFixed(2)}`,
      at: s.placed,
    },
  ];
  if (s.shipped) {
    timeline.push({
      id: `${id}-shipped`,
      kind: "shipping",
      label: "Order shipped",
      detail: `Marked as shipped by ${s.seller[0]} (@${s.seller[1]})`,
      at: s.shipped,
    });
  }
  if (s.delivered) {
    timeline.push({
      id: `${id}-delivered`,
      kind: "shipping",
      label: "Delivered",
      detail: "Carrier confirmed delivery to the buyer's address",
      at: s.delivered,
    });
  }
  timeline.push(
    {
      id: `${id}-opened`,
      kind: "dispute",
      label:
        s.type === "replacement" ? "Replacement requested" : "Dispute opened",
      detail: s.reason,
      at: s.opened,
    },
    {
      id: `${id}-msg`,
      kind: "message",
      label: `Message from ${s.buyer[0]}`,
      detail: `"${s.message}"`,
      at: plus(s.opened, 14),
    }
  );
  if (s.type === "declined_dispute") {
    timeline.push({
      id: `${id}-declined`,
      kind: "dispute",
      label: "Dispute declined by seller",
      detail: `${s.seller[0]} declined the dispute in the transaction thread`,
      at: plus(s.escalated, -55),
    });
  }
  timeline.push({
    id: `${id}-escalated`,
    kind: "escalation",
    label: "Auto-escalated to operator",
    detail: escalationDetail[s.type],
    at: s.escalated,
  });
  if (s.resolution) {
    timeline.push({
      id: `${id}-resolved`,
      kind: "resolution",
      label: resolutionLabel[s.resolution.outcome],
      detail: `Resolved by ${s.resolution.actor}`,
      at: s.resolution.resolvedAt,
    });
  }
  return {
    id,
    transactionId: s.tx,
    buyerName: s.buyer[0],
    buyerHandle: s.buyer[1],
    sellerName: s.seller[0],
    sellerHandle: s.seller[1],
    listingTitle: s.listing,
    amount: s.amount,
    payout: s.payout,
    type: s.type,
    status: s.status,
    disputeReason: s.reason,
    messageExcerpt: s.message,
    escalatedAt: s.escalated,
    lastUpdatedAt: s.updated,
    resolution: s.resolution,
    timeline,
  };
}

export const disputeOrders: DisputeOrder[] = [
  mk({
    n: 1,
    tx: "64a91c2e-7f3b-4d18-9c2a-5e8b1f0d3a47",
    buyer: ["Jonah Kim", "jonahk"],
    seller: ["Amelia Foster", "fosterfinery"],
    listing: "Georgian Mahogany Writing Slope, c. 1810",
    amount: 410,
    payout: 369,
    type: "dispute",
    status: "resolved",
    reason: "Item not as described",
    message:
      "The listing said original brass fittings, but the hinges look like modern replacements.",
    placed: "2026-05-28T15:20:00.000Z",
    shipped: "2026-05-30T10:05:00.000Z",
    delivered: "2026-06-03T18:40:00.000Z",
    opened: "2026-06-04T09:12:00.000Z",
    escalated: "2026-06-05T09:12:00.000Z",
    updated: "2026-06-09T14:30:00.000Z",
    resolution: {
      outcome: "seller",
      resolvedAt: "2026-06-09T14:30:00.000Z",
      actor: "Sameem Amjad",
    },
  }),
  mk({
    n: 2,
    tx: "71be0d4a-2c85-49f1-b3d6-08a4c7e92f15",
    buyer: ["Lena Hoffmann", "lenah"],
    seller: ["Marcus Reed", "reliquaryrow"],
    listing: "Meiji Period Cloisonné Vase",
    amount: 1250,
    payout: 1125,
    type: "dispute",
    status: "refunded",
    reason: "Item arrived damaged",
    message:
      "The vase arrived with a long hairline crack down the enamel — packaging was a single layer of paper.",
    placed: "2026-06-04T11:45:00.000Z",
    shipped: "2026-06-06T09:30:00.000Z",
    delivered: "2026-06-09T20:15:00.000Z",
    opened: "2026-06-10T08:05:00.000Z",
    escalated: "2026-06-11T08:05:00.000Z",
    updated: "2026-06-14T16:10:00.000Z",
    resolution: {
      outcome: "buyer",
      resolvedAt: "2026-06-14T16:10:00.000Z",
      actor: "Sameem Amjad",
    },
  }),
  mk({
    n: 3,
    tx: "8c37f5b1-96e0-4a2d-8f19-d24b60c3a781",
    buyer: ["Priya Raman", "priyar"],
    seller: ["Tom Beckett", "beckettcurios"],
    listing: "Hand-Colored Botanical Engraving, 1874",
    amount: 128,
    payout: 115.2,
    type: "declined_dispute",
    status: "declined",
    reason: "Item never arrived",
    message:
      "Tracking has shown 'in transit' for two weeks now. I still don't have the engraving.",
    placed: "2026-06-08T13:00:00.000Z",
    shipped: "2026-06-10T15:25:00.000Z",
    opened: "2026-06-16T10:40:00.000Z",
    escalated: "2026-06-18T10:40:00.000Z",
    updated: "2026-06-19T09:20:00.000Z",
  }),
  mk({
    n: 4,
    tx: "2f60a8d9-4b13-47c6-a5e2-9c07d1f84b36",
    buyer: ["Marcus Bell", "mbell"],
    seller: ["Margot Devereux", "devereuxmaison"],
    listing: "French Gilt Bronze Carriage Clock",
    amount: 675,
    payout: 607.5,
    type: "dispute",
    status: "resolved",
    reason: "Significant undisclosed damage",
    message:
      "There's a deep scratch across the glass face that wasn't in any of the photos.",
    placed: "2026-06-16T17:30:00.000Z",
    shipped: "2026-06-18T08:50:00.000Z",
    delivered: "2026-06-22T19:05:00.000Z",
    opened: "2026-06-23T07:55:00.000Z",
    escalated: "2026-06-24T07:55:00.000Z",
    updated: "2026-06-29T11:45:00.000Z",
    resolution: {
      outcome: "seller",
      resolvedAt: "2026-06-29T11:45:00.000Z",
      actor: "Sameem Amjad",
    },
  }),
  mk({
    n: 5,
    tx: "b45d29e7-08fa-4c61-97b3-3e1a86d05c92",
    buyer: ["Sofia Marino", "sofiam"],
    seller: ["Chen Wei", "jadeandbrass"],
    listing: "Brass Ship's Compass, Early 1900s",
    amount: 96,
    payout: 86.4,
    type: "replacement",
    status: "replacement",
    reason: "Wrong item shipped",
    message:
      "I received a pocket barometer instead of the compass in the listing photos.",
    placed: "2026-06-22T12:10:00.000Z",
    shipped: "2026-06-24T14:35:00.000Z",
    delivered: "2026-06-28T17:20:00.000Z",
    opened: "2026-06-29T09:00:00.000Z",
    escalated: "2026-06-30T09:00:00.000Z",
    updated: "2026-07-04T10:15:00.000Z",
  }),
  mk({
    n: 6,
    tx: "d90c47f3-5a28-4e9b-80d1-72c5b9e16a04",
    buyer: ["Aisha Karim", "aishak"],
    seller: ["Beatrice Hall", "hallmarkedpast"],
    listing: "Victorian Jet Mourning Brooch",
    amount: 342.5,
    payout: 308.25,
    type: "dispute",
    status: "refunded",
    reason: "Counterfeit / authenticity concern",
    message:
      "A jeweler looked at it and says this is pressed glass, not Whitby jet as described.",
    placed: "2026-06-26T16:05:00.000Z",
    shipped: "2026-06-28T11:40:00.000Z",
    delivered: "2026-07-01T18:55:00.000Z",
    opened: "2026-07-02T10:25:00.000Z",
    escalated: "2026-07-03T10:25:00.000Z",
    updated: "2026-07-07T15:00:00.000Z",
    resolution: {
      outcome: "buyer",
      resolvedAt: "2026-07-07T15:00:00.000Z",
      actor: "Sameem Amjad",
    },
  }),
  mk({
    n: 7,
    tx: "36e8b1a5-c47d-40f2-9b68-1d09e3c75f28",
    buyer: ["Tom Nguyen", "tomn"],
    seller: ["Silvio Conti", "continiestate"],
    listing: "Set of 6 Depression Glass Tumblers",
    amount: 84,
    payout: 75.6,
    type: "declined_dispute",
    status: "declined",
    reason: "Missing pieces from set",
    message: "Only four tumblers were in the box. The listing clearly says a set of six.",
    placed: "2026-06-30T14:50:00.000Z",
    shipped: "2026-07-02T09:15:00.000Z",
    delivered: "2026-07-06T16:30:00.000Z",
    opened: "2026-07-07T08:45:00.000Z",
    escalated: "2026-07-08T08:45:00.000Z",
    updated: "2026-07-09T12:35:00.000Z",
  }),
  mk({
    n: 8,
    tx: "a12f76c8-39b4-4d05-86ce-4f8a02d91b63",
    buyer: ["Elena Petrova", "elenap"],
    seller: ["Harold Whitfield", "oldworldantiques"],
    listing: "Edwardian Oak Barley-Twist Side Table",
    amount: 520,
    payout: 468,
    type: "dispute",
    status: "resolved",
    reason: "Item not as described",
    message:
      "One leg has clearly been re-glued and it wobbles badly — 'excellent condition' is a stretch.",
    placed: "2026-07-06T10:20:00.000Z",
    shipped: "2026-07-08T13:05:00.000Z",
    delivered: "2026-07-12T15:45:00.000Z",
    opened: "2026-07-13T09:30:00.000Z",
    escalated: "2026-07-14T09:30:00.000Z",
    updated: "2026-07-18T10:50:00.000Z",
    resolution: {
      outcome: "seller",
      resolvedAt: "2026-07-18T10:50:00.000Z",
      actor: "Sameem Amjad",
    },
  }),
  mk({
    n: 9,
    tx: "5b9e03d2-61af-4780-b4c9-e37d15a80f46",
    buyer: ["Ryan Walsh", "ryanw"],
    seller: ["Clara Osei", "gildedattic"],
    listing: "Art Nouveau Silver Hand Mirror",
    amount: 189,
    payout: 170.1,
    type: "dispute",
    status: "refunded",
    reason: "Item arrived damaged",
    message:
      "The mirror glass shattered in transit — the box had no padding at all.",
    placed: "2026-07-12T18:40:00.000Z",
    shipped: "2026-07-14T10:55:00.000Z",
    delivered: "2026-07-17T19:25:00.000Z",
    opened: "2026-07-18T07:35:00.000Z",
    escalated: "2026-07-19T07:35:00.000Z",
    updated: "2026-07-23T13:15:00.000Z",
    resolution: {
      outcome: "buyer",
      resolvedAt: "2026-07-23T13:15:00.000Z",
      actor: "Sameem Amjad",
    },
  }),
  mk({
    n: 10,
    tx: "c78a54e0-2d96-4b31-a08f-60b2c4d97e15",
    buyer: ["Camille Dubois", "camilled"],
    seller: ["Victor Ruiz", "ruizrelics"],
    listing: "1920s Cast Iron Mechanical Bank",
    amount: 265,
    payout: 238.5,
    type: "declined_dispute",
    status: "declined",
    reason: "Item not as described",
    message:
      "The paint is almost entirely repainted — the listing called it original surface.",
    placed: "2026-07-15T09:10:00.000Z",
    shipped: "2026-07-17T14:20:00.000Z",
    delivered: "2026-07-20T17:50:00.000Z",
    opened: "2026-07-21T11:05:00.000Z",
    escalated: "2026-07-22T11:05:00.000Z",
    updated: "2026-07-23T08:40:00.000Z",
  }),
  mk({
    n: 11,
    tx: "e03d81b6-7c25-4f94-92a7-85f1d0c36b29",
    buyer: ["Omar Haddad", "omarh"],
    seller: ["Ken Tanaka", "kyotofinds"],
    listing: "Persian Tabriz Wool Rug, 4x6",
    amount: 980,
    payout: 882,
    type: "dispute",
    status: "resolved",
    reason: "Item not as described",
    message:
      "The colors are far more faded than the photos suggested, especially the center medallion.",
    placed: "2026-07-20T15:35:00.000Z",
    shipped: "2026-07-22T08:25:00.000Z",
    delivered: "2026-07-26T14:10:00.000Z",
    opened: "2026-07-26T20:45:00.000Z",
    escalated: "2026-07-27T20:45:00.000Z",
    updated: "2026-08-01T09:55:00.000Z",
    resolution: {
      outcome: "seller",
      resolvedAt: "2026-08-01T09:55:00.000Z",
      actor: "Sameem Amjad",
    },
  }),
  mk({
    n: 12,
    tx: "497fc2a8-b05e-4d67-8319-f6a4d28e05c7",
    buyer: ["Grace Liu", "gracel"],
    seller: ["Margot Devereux", "devereuxmaison"],
    listing: "Louis XVI Style Marble Mantel Clock",
    amount: 1480,
    payout: 1332,
    type: "dispute",
    status: "disputed",
    reason: "Item arrived damaged",
    message:
      "A corner of the marble base is chipped off and the pendulum arm is bent. I have photos.",
    placed: "2026-07-24T12:15:00.000Z",
    shipped: "2026-07-26T16:40:00.000Z",
    delivered: "2026-07-30T18:05:00.000Z",
    opened: "2026-07-30T21:30:00.000Z",
    escalated: "2026-07-31T21:30:00.000Z",
    updated: "2026-08-20T10:05:00.000Z",
  }),
  mk({
    n: 13,
    tx: "f61b39d4-a872-4c50-b1e8-27c90f5d84a3",
    buyer: ["Felix Andersson", "felixa"],
    seller: ["Silvio Conti", "continiestate"],
    listing: "WWII Era Brass Trench Compass",
    amount: 145,
    payout: 130.5,
    type: "declined_dispute",
    status: "declined",
    reason: "Counterfeit / authenticity concern",
    message:
      "The engraving looks laser-etched, not period. I think this is a modern reproduction.",
    placed: "2026-07-28T10:55:00.000Z",
    shipped: "2026-07-30T13:30:00.000Z",
    delivered: "2026-08-02T15:20:00.000Z",
    opened: "2026-08-02T19:10:00.000Z",
    escalated: "2026-08-03T19:10:00.000Z",
    updated: "2026-08-04T14:25:00.000Z",
  }),
  mk({
    n: 14,
    tx: "0d84e6f2-53c9-4ab7-9e04-b18f7a26c5d0",
    buyer: ["Nora Quinn", "noraq"],
    seller: ["Ingrid Larsen", "nordicheirlooms"],
    listing: "Murano Sommerso Glass Vase, 1960s",
    amount: 210,
    payout: 189,
    type: "replacement",
    status: "replacement",
    reason: "Item arrived damaged",
    message:
      "There's a fresh chip on the rim. The seller says she has a near-identical piece she can send.",
    placed: "2026-08-01T09:25:00.000Z",
    shipped: "2026-08-03T11:50:00.000Z",
    delivered: "2026-08-05T17:35:00.000Z",
    opened: "2026-08-05T20:15:00.000Z",
    escalated: "2026-08-06T20:15:00.000Z",
    updated: "2026-08-11T08:30:00.000Z",
  }),
  mk({
    n: 15,
    tx: "9e27a0c5-48d1-4f63-85b2-c60e94f31d78",
    buyer: ["Maya Chen", "mayac"],
    seller: ["Harold Whitfield", "oldworldantiques"],
    listing: "Victorian Sterling Silver Tea Set (5-Piece)",
    amount: 842.5,
    payout: 758.25,
    type: "dispute",
    status: "disputed",
    reason: "Missing pieces from set",
    message:
      "The sugar tongs and strainer shown in photo 3 were not in the parcel.",
    placed: "2026-08-04T14:05:00.000Z",
    shipped: "2026-08-06T10:30:00.000Z",
    delivered: "2026-08-09T16:55:00.000Z",
    opened: "2026-08-09T19:40:00.000Z",
    escalated: "2026-08-10T19:40:00.000Z",
    updated: "2026-08-19T11:20:00.000Z",
  }),
  mk({
    n: 16,
    tx: "3a50d7b9-16e4-4c82-90f5-d84a20c67b91",
    buyer: ["Sam Whitaker", "samw"],
    seller: ["Victor Ruiz", "ruizrelics"],
    listing: "Antique Copper Weathervane — Running Horse",
    amount: 1150,
    payout: 1035,
    type: "dispute",
    status: "disputed",
    reason: "Item never arrived",
    message:
      "Freight carrier says the crate was returned to sender two weeks ago. No refund, no update.",
    placed: "2026-08-05T11:35:00.000Z",
    shipped: "2026-08-07T15:10:00.000Z",
    opened: "2026-08-12T09:50:00.000Z",
    escalated: "2026-08-13T09:50:00.000Z",
    updated: "2026-08-24T16:45:00.000Z",
  }),
  mk({
    n: 17,
    tx: "b26f18e4-90ac-4d35-a7e0-58c31b9d04f6",
    buyer: ["Ivy Nakamura", "ivyn"],
    seller: ["Clara Osei", "gildedattic"],
    listing: "Mid-Century Teak Jewelry Box",
    amount: 78,
    payout: 70.2,
    type: "replacement",
    status: "replacement",
    reason: "Wrong item shipped",
    message:
      "I got someone else's order — a ceramic ashtray. Happy to swap once the right box ships.",
    placed: "2026-08-10T13:20:00.000Z",
    shipped: "2026-08-12T09:45:00.000Z",
    delivered: "2026-08-15T14:30:00.000Z",
    opened: "2026-08-15T17:05:00.000Z",
    escalated: "2026-08-16T17:05:00.000Z",
    updated: "2026-08-21T10:40:00.000Z",
  }),
  mk({
    n: 18,
    tx: "78c4e2a0-d5b9-4681-93cf-a05e17d42b88",
    buyer: ["Daniel Osei", "danielo"],
    seller: ["Ingrid Larsen", "nordicheirlooms"],
    listing: "Art Deco Walnut Mantel Clock, c. 1932",
    amount: 315,
    payout: 283.5,
    type: "dispute",
    status: "disputed",
    reason: "Item not as described",
    message:
      "The movement doesn't run at all. The listing said 'recently serviced, keeps good time'.",
    placed: "2026-08-12T16:50:00.000Z",
    shipped: "2026-08-14T11:15:00.000Z",
    delivered: "2026-08-17T18:20:00.000Z",
    opened: "2026-08-17T21:00:00.000Z",
    escalated: "2026-08-18T21:00:00.000Z",
    updated: "2026-08-25T09:10:00.000Z",
  }),
  mk({
    n: 19,
    tx: "10bd95f7-3e28-4a04-b6d1-97f0c85e23a4",
    buyer: ["Leo Fontaine", "leof"],
    seller: ["Tom Beckett", "beckettcurios"],
    listing: "Framed 18th-Century Nautical Chart",
    amount: 395,
    payout: 355.5,
    type: "declined_dispute",
    status: "declined",
    reason: "Item arrived damaged",
    message:
      "Water damage along the bottom edge — the frame backing was soaked when it arrived.",
    placed: "2026-08-14T10:05:00.000Z",
    shipped: "2026-08-16T12:30:00.000Z",
    delivered: "2026-08-19T15:55:00.000Z",
    opened: "2026-08-19T18:25:00.000Z",
    escalated: "2026-08-20T18:25:00.000Z",
    updated: "2026-08-21T13:50:00.000Z",
  }),
  mk({
    n: 20,
    tx: "ce593ab1-72d0-4f46-8ea3-b04d61c28f57",
    buyer: ["Hana Yusuf", "hanay"],
    seller: ["Beatrice Hall", "hallmarkedpast"],
    listing: "Tiffany-Style Stained Glass Lamp",
    amount: 540,
    payout: 486,
    type: "dispute",
    status: "disputed",
    reason: "Significant undisclosed damage",
    message:
      "Three of the glass panels are cracked and one is missing entirely near the base.",
    placed: "2026-08-16T14:40:00.000Z",
    shipped: "2026-08-18T09:05:00.000Z",
    delivered: "2026-08-21T17:15:00.000Z",
    opened: "2026-08-21T20:35:00.000Z",
    escalated: "2026-08-22T20:35:00.000Z",
    updated: "2026-08-26T08:20:00.000Z",
  }),
  mk({
    n: 21,
    tx: "6f0a2d8c-b491-4e57-a2f8-13c60d94e7b5",
    buyer: ["Peter Kovacs", "peterk"],
    seller: ["Chen Wei", "jadeandbrass"],
    listing: "Hand-Painted Limoges Porcelain Plate Set",
    amount: 168,
    payout: 151.2,
    type: "replacement",
    status: "replacement",
    reason: "Missing pieces from set",
    message:
      "Two of the eight plates are missing. The seller offered to ship the remaining two.",
    placed: "2026-08-18T11:30:00.000Z",
    shipped: "2026-08-20T13:55:00.000Z",
    delivered: "2026-08-23T16:00:00.000Z",
    opened: "2026-08-23T18:45:00.000Z",
    escalated: "2026-08-24T18:45:00.000Z",
    updated: "2026-08-26T15:05:00.000Z",
  }),
  mk({
    n: 22,
    tx: "42d7b0e9-58f3-4c16-97a4-e02b85d13c60",
    buyer: ["Rosa Delgado", "rosad"],
    seller: ["Marcus Reed", "reliquaryrow"],
    listing: "Regency Rosewood Tea Caddy",
    amount: 260,
    payout: 234,
    type: "dispute",
    status: "disputed",
    reason: "Item not as described",
    message:
      "The interior lidded compartments described in the listing have been removed.",
    placed: "2026-08-20T09:55:00.000Z",
    shipped: "2026-08-22T14:25:00.000Z",
    delivered: "2026-08-25T19:30:00.000Z",
    opened: "2026-08-25T22:10:00.000Z",
    escalated: "2026-08-26T22:10:00.000Z",
    updated: "2026-08-27T08:35:00.000Z",
  }),
];
