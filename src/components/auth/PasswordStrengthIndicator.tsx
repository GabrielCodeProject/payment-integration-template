"use client";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface PasswordStrength {
  score: number; // 0-100
  strength: "weak" | "fair" | "good" | "strong";
  feedback: string[];
  criteria: {
    length: boolean;
    lowercase: boolean;
    uppercase: boolean;
    number: boolean;
    special: boolean;
  };
}

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  const criteria = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&]/.test(password),
  };

  const feedback: string[] = [];
  let score = 0;

  // Length scoring
  if (password.length >= 8) {
    score += 20;
  } else {
    feedback.push("At least 8 characters");
  }

  if (password.length >= 12) {
    score += 10;
  }

  // Character type scoring
  if (criteria.lowercase) {
    score += 15;
  } else {
    feedback.push("Include lowercase letters");
  }

  if (criteria.uppercase) {
    score += 15;
  } else {
    feedback.push("Include uppercase letters");
  }

  if (criteria.number) {
    score += 15;
  } else {
    feedback.push("Include numbers");
  }

  if (criteria.special) {
    score += 15;
  } else {
    feedback.push("Include special characters (@$!%*?&)");
  }

  // Bonus points for variety and length
  const varietyCount = Object.values(criteria).filter(Boolean).length;
  if (varietyCount >= 4) {
    score += 10;
  }

  // Additional length bonus
  if (password.length >= 16) {
    score += 10;
  }

  // Penalty for common patterns
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    feedback.push("Avoid repeated characters");
  }

  if (/123|abc|qwe|password/i.test(password)) {
    score -= 15;
    feedback.push("Avoid common patterns");
  }

  score = Math.max(0, Math.min(100, score));

  let strength: PasswordStrength["strength"];
  if (score >= 80) {
    strength = "strong";
  } else if (score >= 60) {
    strength = "good";
  } else if (score >= 40) {
    strength = "fair";
  } else {
    strength = "weak";
  }

  return {
    score,
    strength,
    feedback,
    criteria,
  };
}

export function PasswordStrengthIndicator({
  password,
  className,
}: PasswordStrengthIndicatorProps) {
  const strength = calculatePasswordStrength(password);

  if (!password) {
    return null;
  }

  const getStrengthColor = () => {
    switch (strength.strength) {
      case "strong":
        return "text-green-600 dark:text-green-400";
      case "good":
        return "text-blue-600 dark:text-blue-400";
      case "fair":
        return "text-yellow-600 dark:text-yellow-400";
      case "weak":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-slate-500";
    }
  };

  const getProgressColor = () => {
    switch (strength.strength) {
      case "strong":
        return "bg-green-500";
      case "good":
        return "bg-blue-500";
      case "fair":
        return "bg-yellow-500";
      case "weak":
        return "bg-red-500";
      default:
        return "bg-slate-300";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Password strength
        </span>
        <span className={cn("text-sm font-medium capitalize", getStrengthColor())}>
          {strength.strength}
        </span>
      </div>

      <div className="relative">
        <Progress value={strength.score} className="h-2" />
        <div
          className={cn(
            "absolute top-0 left-0 h-2 rounded-full transition-all duration-300",
            getProgressColor()
          )}
          style={{ width: `${strength.score}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-1">
          <div className={cn("flex items-center gap-1", 
            strength.criteria.length ? "text-green-600" : "text-slate-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", 
              strength.criteria.length ? "bg-green-500" : "bg-slate-300"
            )} />
            8+ characters
          </div>
          <div className={cn("flex items-center gap-1", 
            strength.criteria.lowercase ? "text-green-600" : "text-slate-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", 
              strength.criteria.lowercase ? "bg-green-500" : "bg-slate-300"
            )} />
            Lowercase
          </div>
          <div className={cn("flex items-center gap-1", 
            strength.criteria.uppercase ? "text-green-600" : "text-slate-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", 
              strength.criteria.uppercase ? "bg-green-500" : "bg-slate-300"
            )} />
            Uppercase
          </div>
        </div>
        <div className="space-y-1">
          <div className={cn("flex items-center gap-1", 
            strength.criteria.number ? "text-green-600" : "text-slate-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", 
              strength.criteria.number ? "bg-green-500" : "bg-slate-300"
            )} />
            Numbers
          </div>
          <div className={cn("flex items-center gap-1", 
            strength.criteria.special ? "text-green-600" : "text-slate-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", 
              strength.criteria.special ? "bg-green-500" : "bg-slate-300"
            )} />
            Special chars
          </div>
        </div>
      </div>

      {strength.feedback.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
            To improve:
          </p>
          <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
            {strength.feedback.slice(0, 3).map((item, index) => (
              <li key={index} className="flex items-center gap-1">
                <span className="w-1 h-1 bg-slate-400 rounded-full" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}