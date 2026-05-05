/**
 * @file HelpSupportSheet.tsx — Help & Support section with FAQ and inquiry form.
 *
 * Two tabs:
 * 1. **FAQ** — Expandable list of frequently asked questions.
 * 2. **Contact** — Form to submit a support inquiry (saved to `support_inquiries` table).
 */
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HelpCircle, Send, ChevronDown, MessageSquare, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/** Props for the Help & Support bottom-sheet. */
interface HelpSupportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Static FAQ list. To add/edit FAQ entries, modify this array. */
const faqs = [
  {
    q: "How do I add a record to my collection?",
    a: "Go to the Collection tab and tap the '+' button. You can search by name, scan a barcode, or add manually.",
  },
  {
    q: "How does the AI vinyl grading work?",
    a: "Take 8 high-quality photos (4 quarters of each side) of your vinyl. Our AI analyzes scratches, scuffs, warping, and chips and gives a precise condition score from 0.0 (damaged) to 10.0 (perfect).",
  },
  {
    q: "How do I trade records with someone?",
    a: "Find a record you want in the Discover tab, start a chat with the seller, then create a trade offer from the chat. Both parties must confirm to complete the trade.",
  },
  {
    q: "How do I connect my Discogs account?",
    a: "Go to your Profile tab, scroll to the Discogs section, and tap 'Connect Discogs Account'. You'll be redirected to Discogs to authorize the connection.",
  },
  {
    q: "How do I list a record for sale?",
    a: "In your Collection, tap on a record, then change its status to 'For Sale' and set a price. It will then appear in the Discover tab for other users.",
  },
  {
    q: "What does the wishlist match notification mean?",
    a: "When someone lists a record that matches one on your wishlist (by title/artist or Discogs ID), you'll get a notification so you can reach out to buy or trade.",
  },
  {
    q: "How do I block or report a user?",
    a: "Open a chat with the user, tap the menu icon in the top right, and select 'Report' or 'Block'. Blocked users cannot message you or see your collection.",
  },
  {
    q: "Can I undo a completed trade?",
    a: "No. Once both parties confirm a trade, it's marked as completed. Make sure to review the offer carefully before confirming.",
  },
];

const HelpSupportSheet = ({ open, onOpenChange }: HelpSupportSheetProps) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"faq" | "contact">("faq");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  /**
   * Send a support inquiry. Inserts into `support_inquiries`; admins read it
   * from the admin screen. Subject + message must both be non-empty.
   */
  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim() || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from("support_inquiries").insert({
        user_id: user.id,
        subject: subject.trim(),
        message: message.trim(),
      });
      if (error) throw error;
      toast.success("Inquiry sent! We'll get back to you soon.");
      setSubject("");
      setMessage("");
    } catch {
      toast.error("Failed to send inquiry. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <HelpCircle size={20} className="text-primary" />
            Help & Support
          </SheetTitle>
        </SheetHeader>

        {/* Tab switcher */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setTab("faq")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 font-body text-sm font-medium transition-colors ${
              tab === "faq" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
            }`}
          >
            <BookOpen size={16} />
            FAQ
          </button>
          <button
            onClick={() => setTab("contact")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 font-body text-sm font-medium transition-colors ${
              tab === "contact" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
            }`}
          >
            <MessageSquare size={16} />
            Contact Us
          </button>
        </div>

        <div className="mt-4 overflow-y-auto max-h-[60vh] pr-1">
          {tab === "faq" ? (
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-xl bg-card vinyl-shadow overflow-hidden">
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    className="flex w-full items-center gap-3 p-4"
                  >
                    <span className="flex-1 text-left font-body text-sm font-medium text-foreground">
                      {faq.q}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-muted-foreground transition-transform ${
                        expandedFaq === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {expandedFaq === i && (
                    <div className="px-4 pb-4">
                      <p className="font-body text-sm text-muted-foreground">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="font-body text-sm text-muted-foreground">
                Have a question or issue? Send us a message and our team will get back to you.
              </p>
              <div>
                <label className="font-body text-xs font-medium text-foreground mb-1 block">Subject</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What do you need help with?"
                  className="font-body text-sm"
                />
              </div>
              <div>
                <label className="font-body text-xs font-medium text-foreground mb-1 block">Message</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or question in detail..."
                  rows={5}
                  className="font-body text-sm resize-none"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={sending || !subject.trim() || !message.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-body text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Send size={16} />
                {sending ? "Sending..." : "Send Inquiry"}
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default HelpSupportSheet;
