import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Play, Pause, GripVertical, SkipBack, SkipForward, ChevronDown, ChevronUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";
import { useAudio } from "@/contexts/AudioContext";
import Draggable from "react-draggable";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function AudioPlayer() {
  const { isPlaying, volume, togglePlay, setVolume, audioRef, currentTrack, nextTrack, previousTrack } = useAudio();
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(volume);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Calculate center position on mount
  useEffect(() => {
    const centerX = (window.innerWidth - 300) / 2; // 300 is approximate width of player
    setPosition({ x: centerX, y: 0 });
  }, []);

  const handleDragStop = (e: any, data: { x: number; y: number }) => {
    setPosition({ x: data.x, y: data.y });
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(previousVolume);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Update isMuted state when volume changes
  useEffect(() => {
    if (volume === 0 && !isMuted) {
      setIsMuted(true);
    } else if (volume > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [volume]);

  const volumeControl = !isMobile ? (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          className="h-8 w-8"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="center" 
        className="w-8 p-2"
        sideOffset={5}
      >
        <div className="h-24 flex items-center justify-center">
          <Slider
            value={[volume * 100]}
            onValueChange={handleVolumeChange}
            max={100}
            step={1}
            orientation="vertical"
            className="h-full"
          />
        </div>
      </PopoverContent>
    </Popover>
  ) : (
    <div className="flex items-center gap-2 flex-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMute}
        className="h-8 w-8"
      >
        {isMuted ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </Button>
      <Slider
        value={[volume * 100]}
        onValueChange={handleVolumeChange}
        max={100}
        step={1}
        className="w-full"
      />
    </div>
  );

  const playerContent = (
    <div className={cn(
      "bg-background border rounded-lg p-2",
      !isMobile && "shadow-lg"
    )}>
      <div className="flex items-center gap-2">
        {!isMobile && (
          <div className="drag-handle cursor-move p-1">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {!isCollapsed && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={previousTrack}
              disabled={!currentTrack}
              className="h-8 w-8"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="h-8 w-8"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={nextTrack}
              disabled={!currentTrack}
              className="h-8 w-8"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            {volumeControl}
          </>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className="h-8 w-8"
        >
          {isCollapsed ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return playerContent;
  }

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
      <Draggable
        handle=".drag-handle"
        position={position}
        onStop={handleDragStop}
        grid={[1, 1]}
        bounds="parent"
      >
        <div className="absolute bottom-4 left-0 pointer-events-auto">
          {playerContent}
        </div>
      </Draggable>
    </div>
  );
} 