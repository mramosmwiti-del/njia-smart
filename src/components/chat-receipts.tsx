import { Check, CheckCheck } from "lucide-react";

// Sent / delivered / read ticks for chat messages (like WhatsApp).
//   one grey tick   = sent
//   two grey ticks  = delivered to everyone else in the chat
//   two blue ticks  = read by everyone else in the chat

export type ReceiptState = "sent" | "delivered" | "read";

export type MemberReceipt = {
  user_id: string;
  last_read_at: string | null;
  last_delivered_at: string | null;
  /** When this person joined the chat. Messages sent before that don't wait on them. */
  joined_at?: string | null;
};

const at = (v: string | null | undefined) => (v ? Date.parse(v) : NaN);

/** What one person has done with a message sent at `createdAt`. */
export function receiptFor(createdAt: string, member: MemberReceipt): ReceiptState {
  const t = Date.parse(createdAt);
  if (at(member.last_read_at) >= t) return "read";
  if (at(member.last_delivered_at) >= t) return "delivered";
  return "sent";
}

/** The tick shown on a message: the lowest state across everyone else in the chat. */
export function overallReceipt(createdAt: string, allOthers: MemberReceipt[]): ReceiptState {
  const t = Date.parse(createdAt);
  const others = allOthers.filter(m => !m.joined_at || Date.parse(m.joined_at) <= t);
  if (others.length === 0) return "sent";
  const states = others.map(m => receiptFor(createdAt, m));
  if (states.every(s => s === "read")) return "read";
  if (states.every(s => s === "read" || s === "delivered")) return "delivered";
  return "sent";
}

export const RECEIPT_LABEL: Record<ReceiptState, string> = {
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
};

export function ChatTicks({ state, onClick }: { state: ReceiptState; onClick?: () => void }) {
  const Icon = state === "sent" ? Check : CheckCheck;
  const color = state === "read" ? "text-sky-300" : "text-primary-foreground/70";
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${RECEIPT_LABEL[state]} · tap for message info`}
      aria-label={RECEIPT_LABEL[state]}
      className={`inline-flex align-middle ${color}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/** Who has it, who has read it: shown in the "Message info" popup. */
export function ReceiptRow({ name, state }: { name: string; state: ReceiptState }) {
  const Icon = state === "sent" ? Check : CheckCheck;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="truncate">{name}</span>
      <span className={`inline-flex items-center gap-1.5 text-xs ${state === "read" ? "text-sky-500" : "text-muted-foreground"}`}>
        <Icon className="h-3.5 w-3.5" /> {RECEIPT_LABEL[state]}
      </span>
    </div>
  );
}
