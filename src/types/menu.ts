export type CompanionStateLabel =
  | 'Idle'
  | 'Walking'
  | 'Sitting'
  | 'Sleeping'
  | 'Waving'
  | 'Curious'
  | 'Dragged'
  | 'Falling'
  | 'Landing'
  | 'Dancing'
  | 'Thinking'
  | 'Resting'
  | 'Playful';

export interface MenuItemAction {
  id: string;
  label: string;
  section: 'presence' | 'movement' | 'interactions' | 'application';
  icon: string;
  shortcut?: string;
  isToggle?: boolean;
  checked?: boolean;
  disabled?: boolean;
  isDanger?: boolean;
  hasPlayIcon?: boolean;
  onExecute: () => void;
}

export interface InteractionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  characterState: CompanionStateLabel;
  isPinned: boolean;
  onTogglePin: () => void;
  onHideAppu: () => void;
  onReturnHome: () => void;
  onWaveHello: () => void;
  onWalk?: () => void;
  onTakeSeat: () => void;
  onGoToSleep: () => void;
  onCheer?: () => void;
  onThink?: () => void;
  onSurprised?: () => void;
  onClap?: () => void;
  onDance?: () => void;
  onStandUp?: () => void;
  onOpenSettings: () => void;
  onQuitAppu: () => void;
  isWalkingHome?: boolean;
  onOpenActionsGallery?: (category?: string) => void;
  activeActionId?: string | null;
  followCursorEnabled?: boolean;
  onToggleFollowCursor?: () => void;
  onWalkToHere?: () => void;
  onOpenReminders?: () => void;
  onOpenQuickAppu?: () => void;
  onOpenAssistantTab?: (tab: 'reminders' | 'tasks' | 'notes' | 'chat') => void;
  assistantName?: string;
  availableActions?: string[] | null;
}
