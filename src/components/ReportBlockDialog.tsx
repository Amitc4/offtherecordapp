/**
 * @file ReportBlockDialog.tsx — Dialog for reporting or blocking another user.
 *
 * **Three-step flow:**
 * 1. **Choose** – "Report User" or "Block User".
 * 2. **Report** – Select a reason (spam, harassment, fake listing, etc.) and
 *    optionally describe the issue. Inserts a row into `user_reports`.
 * 3. **Block** – Confirmation dialog. Inserts a row into `user_blocks`, which
 *    hides the blocked user's listings and prevents messaging.
 *
 * Accessible from the Discover record detail sheet and the chat header.
 */
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const REPORT_REASONS = [
  "Spam or scam",
  "Harassment or abuse",
  "Fake listing",
  "Inappropriate content",
  "Other",
];

interface ReportBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName: string;
}

const ReportBlockDialog = ({ open, onOpenChange, targetUserId, targetUserName }: ReportBlockDialogProps) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<"choose" | "report" | "block">("choose");
  const [selectedReason, setSelectedReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setMode("choose");
    setSelectedReason("");
    setDescription("");
  };

  const handleReport = async () => {
    if (!user || !selectedReason) return;
    setSubmitting(true);
    const { error } = await supabase.from("user_reports").insert({
      reporter_id: user.id,
      reported_id: targetUserId,
      reason: selectedReason,
      description: description.trim() || null,
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error("Failed to submit report");
    } else {
      toast.success("Report submitted. We'll review it shortly.");
      reset();
      onOpenChange(false);
    }
  };

  const handleBlock = async () => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("user_blocks").insert({
      blocker_id: user.id,
      blocked_id: targetUserId,
    } as any);
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") toast.info("User already blocked");
      else toast.error("Failed to block user");
    } else {
      toast.success(`${targetUserName} has been blocked`);
      reset();
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <AlertDialogContent className="max-w-sm">
        {mode === "choose" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">{targetUserName}</AlertDialogTitle>
              <AlertDialogDescription className="font-body">What would you like to do?</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2 font-body" onClick={() => setMode("report")}>
                🚩 Report User
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 font-body text-destructive hover:text-destructive" onClick={() => setMode("block")}>
                🚫 Block User
              </Button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        )}

        {mode === "report" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">Report {targetUserName}</AlertDialogTitle>
              <AlertDialogDescription className="font-body">Select a reason and provide details.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setSelectedReason(reason)}
                    className={`flex w-full items-center rounded-lg px-3 py-2.5 font-body text-sm transition-colors ${
                      selectedReason === reason
                        ? "bg-primary/10 text-primary font-medium"
                        : "bg-muted/50 text-foreground hover:bg-muted"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us more about what happened (optional)..."
                className="font-body text-sm min-h-[80px]"
                maxLength={500}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-body" onClick={() => setMode("choose")}>Back</AlertDialogCancel>
              <Button onClick={handleReport} disabled={!selectedReason || submitting} className="font-body">
                {submitting ? "Submitting..." : "Submit Report"}
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {mode === "block" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">Block {targetUserName}?</AlertDialogTitle>
              <AlertDialogDescription className="font-body">
                They won't be able to see your listings or send you messages. You can unblock them later from settings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-body" onClick={() => setMode("choose")}>Back</AlertDialogCancel>
              <Button variant="destructive" onClick={handleBlock} disabled={submitting} className="font-body">
                {submitting ? "Blocking..." : "Block User"}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ReportBlockDialog;
