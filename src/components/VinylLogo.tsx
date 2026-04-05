/**
 * @file VinylLogo.tsx — Animated vinyl record logo.
 *
 * Renders the app's logo image (`vinyl-logo.jpg`) in a circular frame.
 * When `spinning` is true, the image rotates continuously (8s per revolution)
 * using Framer Motion. Used on the LoginPage.
 */
import vinylImage from "@/assets/vinyl-logo.jpg";

const VinylLogo = ({ size = 200, spinning = false }: { size?: number; spinning?: boolean }) => {
  return (
    <div className="relative flex flex-col items-center">
      <motion.div
        style={{ width: size, height: size }}
        initial={{ rotate: 0 }}
        animate={spinning ? { rotate: 360 } : {}}
        transition={spinning ? { duration: 8, repeat: Infinity, ease: "linear" } : {}}
      >
        <img
          src={vinylImage}
          alt="Off The Record"
          style={{ width: size, height: size }}
          className="rounded-full object-cover"
        />
      </motion.div>
    </div>
  );
};

export default VinylLogo;
