import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Magazine } from "@/lib/types";
import { deleteMagazine, fetchMagazines, uploadMagazine } from "@/lib/supabaseService";

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function formatDate(value: string) {
  if (!value) return "Date not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDownloadUrl(magazine: Magazine) {
  try {
    const url = new URL(magazine.file_url);
    const extension = url.pathname.match(/\.([a-z0-9]+)$/i)?.[0] ?? ".pdf";
    const fileName = `${magazine.title || "magazine"}${extension}`.replace(/[/\\?%*:|"<>]/g, "-");
    url.searchParams.set("download", fileName);
    return url.toString();
  } catch {
    return magazine.file_url;
  }
}

export default function MagazinesSection() {
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const user = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("gcu_user") || "{}") as { role?: string };
    } catch {
      return {};
    }
  }, []);

  const canManage = user.role === "admin" || user.role === "librarian";

  const loadMagazines = useCallback(async () => {
    try {
      const data = await fetchMagazines();
      setMagazines(data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load magazines"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMagazines();
  }, [loadMagazines]);

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setFile(null);
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManage) {
      toast.error("Only admin and librarian accounts can upload magazines");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a magazine title");
      return;
    }

    if (!file) {
      toast.error("Please choose a magazine file");
      return;
    }

    setSaving(true);
    try {
      const uploadedMagazine = await uploadMagazine({
        title,
        category,
        file,
      });

      setMagazines((current) => [uploadedMagazine, ...current]);
      resetForm();
      toast.success("Magazine uploaded successfully");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to upload magazine"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (magazine: Magazine) => {
    if (!window.confirm(`Delete "${magazine.title}"?`)) return;

    setDeletingId(magazine.id);
    try {
      await deleteMagazine(magazine.id);
      setMagazines((current) => current.filter((item) => item.id !== magazine.id));
      toast.success("Magazine deleted successfully");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete magazine"));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <form onSubmit={handleUpload} className="bg-card rounded-xl shadow-card border border-border p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Upload Magazine</h2>
              <p className="text-sm text-muted-foreground">Admin and librarian access</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_220px_1.2fr_auto] lg:items-end">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Title<span className="text-destructive ml-1">*</span>
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Enter magazine title"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Category</label>
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="General"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                File<span className="text-destructive ml-1">*</span>
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-border bg-background text-sm text-muted-foreground file:mr-3 file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-border"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? "Uploading" : "Upload"}
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Magazines</h2>
          <p className="text-sm text-muted-foreground">{magazines.length} uploaded magazine{magazines.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {magazines.map((magazine) => (
          <article key={magazine.id} className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-elevated transition-shadow">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground truncate">{magazine.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{formatDate(magazine.created_at)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs">
                    {magazine.category || "General"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <a
                href={getDownloadUrl(magazine)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
              {canManage && (
                <button
                  onClick={() => handleDelete(magazine)}
                  disabled={deletingId === magazine.id}
                  title="Delete magazine"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-60"
                >
                  {deletingId === magazine.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {magazines.length === 0 && (
        <div className="bg-card rounded-xl p-8 shadow-card border border-border text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No magazines uploaded</p>
        </div>
      )}
    </div>
  );
}
