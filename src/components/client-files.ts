import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Short-lived signed URL for a file in any storage bucket (default 60 seconds). */
export async function signedFileUrl(bucket: string, path: string, seconds = 60): Promise<{ url: string } | { error: string }> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error) return { error: error.message };
  return { url: data.signedUrl };
}

/** Opens a stored file in a new tab, toasting any error. */
export async function openStoredFile(bucket: string, path: string, seconds = 60) {
  const res = await signedFileUrl(bucket, path, seconds);
  if ("error" in res) toast.error(res.error);
  else window.open(res.url, "_blank", "noopener,noreferrer");
}

/** Same helpers for the main client-documents bucket. */
export const signedClientFileUrl = (path: string, seconds = 60) => signedFileUrl("client-documents", path, seconds);
export const openClientFile = (path: string) => openStoredFile("client-documents", path);
