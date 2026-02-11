import { User, Settings, LogOut, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ProfileScreen = ({ onLogout }: { onLogout: () => void }) => {
  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="mb-4 font-display text-xl font-bold text-foreground">Profile</h1>

      {/* Avatar & info */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary font-display text-xl font-bold text-primary-foreground">
          J
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">John Doe</h2>
          <p className="font-body text-sm text-muted-foreground">12 records · 3 trades</p>
        </div>
      </div>

      {/* Menu items */}
      <div className="space-y-1">
        {[
          { icon: User, label: "Edit Profile" },
          { icon: Settings, label: "Settings" },
        ].map((item) => (
          <button
            key={item.label}
            className="flex w-full items-center gap-3 rounded-xl p-4 transition-colors hover:bg-card"
          >
            <item.icon size={18} className="text-muted-foreground" />
            <span className="flex-1 text-left font-body text-sm font-medium text-foreground">{item.label}</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        ))}
      </div>

      <div className="mt-8">
        <Button
          variant="outline"
          onClick={onLogout}
          className="w-full border-border font-body text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut size={16} className="mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default ProfileScreen;
