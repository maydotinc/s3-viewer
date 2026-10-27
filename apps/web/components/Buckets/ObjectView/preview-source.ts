import { useRef, useState } from "react";
import type { S3ObjectPreview } from "@s3-viewer/shared";
import { useAbortableTask } from "@/lib/hooks/useAbortableTask";
import { previewBodyVersion } from "@/lib/utils/s3/preview-body";

type RefreshPreview = () => Promise<S3ObjectPreview | undefined>;

type Playback = { time: number; paused: boolean };

const usePreviewSource = (
   preview: S3ObjectPreview,
   refreshPreview?: RefreshPreview
) => {
   const [source, setSource] = useState(preview);
   const [generation, setGeneration] = useState(0);
   const [failed, setFailed] = useState(false);
   const [recovering, setRecovering] = useState(false);
   const media = useRef<HTMLMediaElement | null>(null);
   const playback = useRef<Playback | null>(null);
   const recoveryProgress = useRef<{ time: number; seconds: number } | null>(
      null
   );
   const attempted = useRef(false);
   const pending = useRef(false);
   const task = useAbortableTask();

   const recover = async (manual = false) => {
      if (pending.current) return;
      if (attempted.current && !manual) {
         setFailed(true);
         return;
      }
      attempted.current = true;
      pending.current = true;
      setRecovering(true);
      if (media.current) {
         recoveryProgress.current = {
            time: media.current.currentTime,
            seconds: 0,
         };
         playback.current = {
            time: media.current.currentTime,
            paused: media.current.paused,
         };
      }
      try {
         const next =
            preview.url === source.url ||
            Date.parse(preview.expiresAt) <= Date.now()
               ? await refreshPreview?.()
               : preview;
         task.ifMounted(() => {
            if (
               !next ||
               !Number.isFinite(Date.parse(next.expiresAt)) ||
               Date.parse(next.expiresAt) <= Date.now()
            ) {
               setFailed(true);
               return;
            }
            if (previewBodyVersion(next) !== previewBodyVersion(source))
               playback.current = null;
            setFailed(false);
            setSource(next);
            if (next.url === source.url) setGeneration((value) => value + 1);
         });
      } catch {
         task.ifMounted(() => setFailed(true));
      } finally {
         pending.current = false;
         task.ifMounted(() => setRecovering(false));
      }
   };

   const loaded = () => {
      attempted.current = false;
   };

   const playbackProgress = () => {
      const element = media.current;
      const progress = recoveryProgress.current;
      if (!element || !progress) return;
      const delta = element.currentTime - progress.time;
      progress.time = element.currentTime;
      if (
         element.seeking ||
         element.readyState < HTMLMediaElement.HAVE_FUTURE_DATA ||
         delta < 0 ||
         delta > 5
      ) {
         progress.seconds = 0;
         return;
      }
      progress.seconds += delta;
      if (progress.seconds >= 1) {
         attempted.current = false;
         recoveryProgress.current = null;
      }
   };

   const restorePlayback = () => {
      const element = media.current;
      const resume = playback.current;
      if (!element || !resume) return;
      playback.current = null;
      element.currentTime = Number.isFinite(element.duration)
         ? Math.min(resume.time, element.duration)
         : resume.time;
      if (!resume.paused) void element.play().catch(() => undefined);
   };

   return {
      source,
      generation,
      failed,
      recovering,
      media,
      recover,
      restorePlayback,
      playbackProgress,
      loaded,
   };
};

export { usePreviewSource };
export type { RefreshPreview };
