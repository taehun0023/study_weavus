"use client";

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Project = { id: number; name: string; slug: string; course_id: number };
type Category = {
  id: number;
  name: string;
  order_index: number;
  parent_id: number | null;
};
type FileItem = {
  id: number;
  title: string;
  upload_id: number;
  filename: string;
  mime: string;
  size: number;
  created_at: string;
};

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");
  if (!ct.includes("application/json"))
    return { __raw: text, __status: res.status };
  if (!text) return { __raw: "", __status: res.status };
  try {
    return JSON.parse(text);
  } catch {
    return { __raw: text, __status: res.status };
  }
}

type StopEvt = (e: any) => void;

type CategoryNodeProps = {
  c: Category;
  depth: number;
  tree: Map<number | null, Category[]>;
  isAdmin: boolean;
  busy: boolean;

  filesMap: Record<number, FileItem[]>;
  newFileTitle: Record<number, string>;
  setNewFileTitle: Dispatch<SetStateAction<Record<number, string>>>;
  subCatName: Record<number, string>;
  setSubCatName: Dispatch<SetStateAction<Record<number, string>>>;

  refreshFiles: (categoryId: number) => Promise<void>;
  uploadAndAttach: (categoryId: number, file: File) => Promise<void>;
  deleteFile: (fileId: number, categoryId: number) => Promise<void>;

  renameCategory: (categoryId: number) => Promise<void>;
  deleteCategory: (categoryId: number) => Promise<void>;
  createSubCategory: (parentId: number) => Promise<void>;

  stop: StopEvt;
};

const CategoryNode = memo(function CategoryNode(props: CategoryNodeProps) {
  const {
    c,
    depth,
    tree,
    isAdmin,
    busy,
    filesMap,
    newFileTitle,
    setNewFileTitle,
    subCatName,
    setSubCatName,
    refreshFiles,
    uploadAndAttach,
    deleteFile,
    renameCategory,
    deleteCategory,
    createSubCategory,
    stop,
  } = props;

  const children = tree.get(c.id) ?? [];
  const indent = Math.min(depth, 6) * 12;

  // ✅ 각 노드의 "자식 토글" 상태를 노드 내부에서 유지 (cats refresh해도 닫히지 않게)
  const [openChildren, setOpenChildren] = useState<string[]>([]);
  const handleOpenChildrenChange = (v: string | string[]) => {
    const arr = Array.isArray(v) ? v : v ? [v] : [];
    setOpenChildren(arr);
  };

  return (
    <div style={{ marginLeft: indent }}>
      <AccordionItem
        value={`cat-${c.id}`}
        className="rounded-xl border border-border bg-card px-3"
      >
        <div className="flex items-center justify-between gap-2 py-1">
          <AccordionTrigger
            className="flex w-full items-center justify-start text-left cursor-pointer [&>svg:last-child]:hidden py-1"
            onClick={() => {
              refreshFiles(c.id).catch(() => {});
            }}
          >
            <div className="font-semibold leading-tight">{c.name}</div>
          </AccordionTrigger>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => renameCategory(c.id)}
                disabled={busy}
                type="button"
              >
                수정
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="cursor-pointer"
                onClick={() => deleteCategory(c.id)}
                disabled={busy}
                type="button"
              >
                삭제
              </Button>
            </div>
          )}
        </div>

        <AccordionContent>
          {/*
            ⚠️ 중요: 여기에서 onClickCapture / onPointerDownCapture 를 전체에 걸어버리면
            React의 synthetic event 전파가 끊기면서 버튼(onClick)이 안 먹는 케이스가 생길 수 있음.

            포커스 튐은 "타이핑(keydown)"이 Trigger까지 올라가 Radix typeahead로 처리되는 게 주 원인이라
            keydown만 차단하고, pointer 이벤트는 입력 요소(input/file)에서만 막는다.
          */}
          <div className="space-y-3 pb-3" onKeyDownCapture={stop}>
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={newFileTitle[c.id] ?? ""}
                  onChange={(e) =>
                    setNewFileTitle((p) => ({
                      ...p,
                      [c.id]: e.target.value,
                    }))
                  }
                  placeholder="파일 제목 (예: 요건정의서 v1)"
                  className="h-9 w-[280px] rounded-md border border-border bg-background px-3 text-sm outline-none"
                />

                <label
                  className="inline-flex items-center"
                  onPointerDownCapture={stop}
                >
                  <input
                    type="file"
                    className="hidden"
                    onPointerDownCapture={stop}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      uploadAndAttach(c.id, f).catch(() => {});
                      e.currentTarget.value = "";
                    }}
                  />
                  <span className="inline-flex h-9 items-center rounded-md border border-border bg-secondary px-3 text-sm cursor-pointer">
                    파일 추가
                  </span>
                </label>
              </div>
            )}

            <div className="space-y-2">
              {(filesMap[c.id] ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  파일이 없습니다.
                </div>
              ) : (
                (filesMap[c.id] ?? [])
                  .sort((a, b) =>
                    (a.title ?? "").localeCompare(b.title ?? "", undefined, {
                      numeric: true,
                      sensitivity: "base",
                    }),
                  )
                  .map((f) => (
                    <div
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium">{f.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {f.filename} · {(f.size / 1024).toFixed(0)} KB
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                        >
                          <a href={`/api/upload/${f.upload_id}?download=1`}>
                            다운로드
                          </a>
                        </Button>

                        {isAdmin && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => deleteFile(f.id, c.id)}
                            disabled={busy}
                            type="button"
                          >
                            삭제
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>

            {isAdmin && (
              <div className="pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={subCatName[c.id] ?? ""}
                    onChange={(e) =>
                      setSubCatName((p) => ({
                        ...p,
                        [c.id]: e.target.value,
                      }))
                    }
                    placeholder="서브 카테고리 추가"
                    className="h-9 w-[280px] rounded-md border border-border bg-background px-3 text-sm outline-none"
                  />

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => createSubCategory(c.id)}
                    disabled={busy}
                    className="cursor-pointer"
                    type="button"
                  >
                    서브 카테고리 추가
                  </Button>
                </div>
              </div>
            )}

            {children.length > 0 && (
              <div className="pt-2">
                <Accordion
                  type="multiple"
                  className="space-y-2"
                  value={openChildren}
                  onValueChange={handleOpenChildrenChange}
                >
                  {children.map((ch) => (
                    <CategoryNode
                      key={ch.id}
                      c={ch}
                      depth={depth + 1}
                      tree={tree}
                      isAdmin={isAdmin}
                      busy={busy}
                      filesMap={filesMap}
                      newFileTitle={newFileTitle}
                      setNewFileTitle={setNewFileTitle}
                      subCatName={subCatName}
                      setSubCatName={setSubCatName}
                      refreshFiles={refreshFiles}
                      uploadAndAttach={uploadAndAttach}
                      deleteFile={deleteFile}
                      renameCategory={renameCategory}
                      deleteCategory={deleteCategory}
                      createSubCategory={createSubCategory}
                      stop={stop}
                    />
                  ))}
                </Accordion>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </div>
  );
});

export default function ProjectDetail({
  project,
  isAdmin,
}: {
  project: Project;
  isAdmin: boolean;
}) {
  const router = useRouter();

  const [cats, setCats] = useState<Category[]>([]);
  const [filesMap, setFilesMap] = useState<Record<number, FileItem[]>>({});
  const [loading, setLoading] = useState(true);

  const [newCat, setNewCat] = useState("");
  const [subCatName, setSubCatName] = useState<Record<number, string>>({});
  const [newFileTitle, setNewFileTitle] = useState<Record<number, string>>({});

  const [editName, setEditName] = useState(project.name);
  const [editSlug, setEditSlug] = useState(project.slug);

  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // ✅ FIX: Accordion typeahead(문자 검색)로 포커스가 트리거로 튀는 문제 방지
  // input에서 keydown/click이 Accordion까지 버블링되면, Radix가 "typeahead"로 받아 포커스를 빼앗음
  const stop = (e: any) => {
    e.stopPropagation();
  };

  async function loadCategories() {
    const r = await fetch(`/api/projects/${project.id}/categories`, {
      cache: "no-store",
    });
    const j: any = await safeJson(r);
    if (!r.ok)
      throw new Error(j?.message || `카테고리 로드 실패 (HTTP ${r.status})`);
    setCats((j?.items ?? []) as Category[]);
  }

  async function refreshCategories() {
    await loadCategories();
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);

    loadCategories()
      .catch(
        (e) =>
          alive && setErrorMsg(e instanceof Error ? e.message : "로드 실패"),
      )
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function refreshFiles(categoryId: number) {
    const r = await fetch(
      `/api/projects/${project.id}/categories/${categoryId}/files`,
      {
        cache: "no-store",
      },
    );
    const j: any = await safeJson(r);
    if (!r.ok)
      throw new Error(j?.message || `파일 로드 실패 (HTTP ${r.status})`);
    setFilesMap((prev) => ({
      ...prev,
      [categoryId]: (j?.items ?? []) as FileItem[],
    }));
  }

  async function createCategoryRoot() {
    const name = newCat.trim();
    if (!name) return;

    setBusy(true);
    setErrorMsg("");

    const res = await fetch(`/api/projects/${project.id}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: null }),
    });

    const j: any = await safeJson(res);
    setBusy(false);

    if (!res.ok) {
      setErrorMsg(j?.message || `카테고리 생성 실패 (HTTP ${res.status})`);
      return;
    }

    setNewCat("");
    await refreshCategories();
  }

  async function createSubCategory(parentId: number) {
    const name = (subCatName[parentId] ?? "").trim();
    if (!name) return;

    setBusy(true);
    setErrorMsg("");

    const res = await fetch(`/api/projects/${project.id}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId }),
    });

    const j: any = await safeJson(res);
    setBusy(false);

    if (!res.ok) {
      setErrorMsg(j?.message || `서브 카테고리 생성 실패 (HTTP ${res.status})`);
      return;
    }

    setSubCatName((p) => ({ ...p, [parentId]: "" }));
    await refreshCategories();
  }

  async function renameCategory(categoryId: number) {
    const cur = cats.find((c) => c.id === categoryId);
    if (!cur) return;

    const next = window.prompt("카테고리 이름 수정", cur.name);
    if (next === null) return;

    const name = next.trim();
    if (!name) return;

    setBusy(true);
    setErrorMsg("");

    const res = await fetch(
      `/api/projects/${project.id}/categories/${categoryId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      },
    );
    const j: any = await safeJson(res);

    setBusy(false);

    if (!res.ok) {
      setErrorMsg(j?.message || `카테고리 수정 실패 (HTTP ${res.status})`);
      return;
    }

    await refreshCategories();
  }

  async function deleteCategory(categoryId: number) {
    if (
      !window.confirm(
        "카테고리를 삭제할까요? (서브카테고리/안의 파일 목록도 같이 삭제될 수 있습니다)",
      )
    )
      return;

    setBusy(true);
    setErrorMsg("");

    const res = await fetch(
      `/api/projects/${project.id}/categories/${categoryId}`,
      {
        method: "DELETE",
      },
    );
    const j: any = await safeJson(res);

    setBusy(false);

    if (!res.ok) {
      setErrorMsg(j?.message || `카테고리 삭제 실패 (HTTP ${res.status})`);
      return;
    }

    setFilesMap((p) => {
      const next = { ...p };
      delete next[categoryId];
      return next;
    });

    await refreshCategories();
  }

  async function uploadAndAttach(categoryId: number, file: File) {
    setBusy(true);
    setErrorMsg("");

    try {
      const listRes = await fetch(
        `/api/projects/${project.id}/categories/${categoryId}/files`,
        { cache: "no-store" },
      );
      const listJson: any = await safeJson(listRes);
      if (!listRes.ok)
        throw new Error(
          listJson?.message || `파일 목록 조회 실패 (HTTP ${listRes.status})`,
        );

      const currentFiles = (listJson?.items ?? []) as FileItem[];
      const dup = currentFiles.find(
        (x) => (x.filename ?? "").trim() === file.name.trim(),
      );

      let overwrite = false;
      let existingFileId: number | undefined = undefined;

      if (dup) {
        const ok = window.confirm(
          `이미 등록된 파일입니다.\n"${file.name}"\n덮어쓰시겠습니까?`,
        );
        if (!ok) return;
        overwrite = true;
        existingFileId = dup.id;
      }

      const form = new FormData();
      form.append("file", file);

      const upRes = await fetch("/api/upload", { method: "POST", body: form });
      const upJ: any = await safeJson(upRes);
      if (!upRes.ok)
        throw new Error(upJ?.message || `업로드 실패 (HTTP ${upRes.status})`);

      let uploadId = Number(upJ?.id ?? NaN);
      if (!Number.isFinite(uploadId)) {
        const url = String(upJ?.url ?? "");
        const m = url.match(/\/api\/upload\/(\d+)/);
        if (m) uploadId = Number(m[1]);
      }
      if (!Number.isFinite(uploadId) || uploadId <= 0) {
        throw new Error("업로드 응답에 id/url이 없습니다.");
      }

      const title = (newFileTitle[categoryId] ?? file.name).trim() || file.name;

      const attachRes = await fetch(
        `/api/projects/${project.id}/categories/${categoryId}/files`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            uploadId,
            overwrite,
            existingFileId,
            filename: file.name,
          }),
        },
      );

      const attachJ: any = await safeJson(attachRes);
      if (!attachRes.ok) {
        throw new Error(
          attachJ?.message || `등록 실패 (HTTP ${attachRes.status})`,
        );
      }

      setNewFileTitle((p) => ({ ...p, [categoryId]: "" }));
      await refreshFiles(categoryId);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "파일 추가 실패");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFile(fileId: number, categoryId: number) {
    if (!window.confirm("이 파일을 목록에서 삭제할까요?")) return;

    setBusy(true);
    setErrorMsg("");

    const res = await fetch(`/api/project-files/${fileId}`, {
      method: "DELETE",
    });
    const j: any = await safeJson(res);

    setBusy(false);

    if (!res.ok) {
      setErrorMsg(j?.message || `파일 삭제 실패 (HTTP ${res.status})`);
      return;
    }

    await refreshFiles(categoryId);
  }

  async function updateProject() {
    const name = editName.trim();
    const slug = editSlug.trim().toLowerCase();
    if (!name) {
      setErrorMsg("프로젝트 제목을 입력하세요.");
      return;
    }
    if (!slug) {
      setErrorMsg("프로젝트 slug를 입력하세요.");
      return;
    }

    setBusy(true);
    setErrorMsg("");

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });
    const j: any = await safeJson(res);

    setBusy(false);

    if (!res.ok) {
      setErrorMsg(j?.message || `프로젝트 수정 실패 (HTTP ${res.status})`);
      return;
    }

    router.refresh();
  }

  async function deleteProject() {
    if (
      !window.confirm(
        "프로젝트를 삭제할까요? (카테고리/파일 목록도 모두 삭제됩니다)",
      )
    )
      return;

    setBusy(true);
    setErrorMsg("");

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "DELETE",
    });
    const j: any = await safeJson(res);

    setBusy(false);

    if (!res.ok) {
      setErrorMsg(j?.message || `프로젝트 삭제 실패 (HTTP ${res.status})`);
      return;
    }

    router.push("/projects");
  }

  const tree = useMemo(() => {
    const map = new Map<number | null, Category[]>();
    for (const c of cats) {
      const key = c.parent_id ?? null;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const oi = (a.order_index ?? 0) - (b.order_index ?? 0);
        if (oi !== 0) return oi;
        const nn = a.name.localeCompare(b.name);
        if (nn !== 0) return nn;
        return a.id - b.id;
      });
      map.set(k, arr);
    }

    return map;
  }, [cats]);

  const [openAccordions, setOpenAccordions] = useState<string[]>([]);
  const handleOpenAccordionsChange = (v: string | string[]) => {
    const arr = Array.isArray(v) ? v : v ? [v] : [];
    setOpenAccordions(arr);
  };
  const rootCats = tree.get(null) ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xl font-bold">{project.name}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {project.slug}
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="cursor-pointer"
                onClick={updateProject}
                disabled={busy}
                type="button"
              >
                수정
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="cursor-pointer"
                onClick={deleteProject}
                disabled={busy}
                type="button"
              >
                삭제
              </Button>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="프로젝트 제목"
              className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none"
            />
            <input
              value={editSlug}
              onChange={(e) => setEditSlug(e.target.value)}
              placeholder="slug (예: movie-rental-system)"
              className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none"
            />
          </div>
        )}

        {isAdmin && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="카테고리 추가 (예: 요건정의서)"
              className="h-9 w-[320px] rounded-md border border-border bg-background px-3 text-sm outline-none"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={createCategoryRoot}
              disabled={busy}
              className="cursor-pointer"
              type="button"
            >
              카테고리 추가
            </Button>
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">불러오는 중...</div>
      )}

      {!loading && rootCats.length === 0 && (
        <div className="text-sm text-muted-foreground">
          카테고리가 없습니다. (예: 요건정의서 / 기본설계서 / 상세설계서 /
          화면정의안)
        </div>
      )}

      <Accordion
        type="multiple"
        className="space-y-2"
        value={openAccordions}
        onValueChange={handleOpenAccordionsChange}
      >
        {rootCats.map((c) => (
          <CategoryNode
            key={c.id}
            c={c}
            depth={0}
            tree={tree}
            isAdmin={isAdmin}
            busy={busy}
            filesMap={filesMap}
            newFileTitle={newFileTitle}
            setNewFileTitle={setNewFileTitle}
            subCatName={subCatName}
            setSubCatName={setSubCatName}
            refreshFiles={refreshFiles}
            uploadAndAttach={uploadAndAttach}
            deleteFile={deleteFile}
            renameCategory={renameCategory}
            deleteCategory={deleteCategory}
            createSubCategory={createSubCategory}
            stop={stop}
          />
        ))}
      </Accordion>
    </div>
  );
}
