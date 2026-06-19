import { Icon } from "@crestly/icons";
import { useToast } from "./Toast";
import { openWhatsappShare, type WhatsappShareInput } from "@/lib/whatsapp-share";

/* ============================================================
   "Share on WhatsApp" button — opens wa.me with a prefilled
   message. If no phone is supplied, opens the WhatsApp contact
   chooser. Pure client-side; doesn't go through the API.

   Usage:
     <WhatsappShareButton
       phone={student.fatherPhone}
       message={receiptMessage({ ... })}
       label="Share receipt"
     />
   ============================================================ */

export function WhatsappShareButton({
  phone, message, label = "Share on WhatsApp",
  size = "sm", variant = "ghost",
}: WhatsappShareInput & {
  label?: string;
  size?: "sm" | "md";
  variant?: "ghost" | "primary";
}) {
  const toast = useToast();
  function onClick() {
    if (!message.trim()) {
      toast.error("Nothing to share — empty message.");
      return;
    }
    openWhatsappShare({ phone, message });
  }
  const klass = `btn btn--${variant} ${size === "sm" ? "btn--sm" : ""}`;
  return (
    <button type="button" className={klass} onClick={onClick}>
      <Icon name="whatsapp" size={14} /> {label}
    </button>
  );
}
