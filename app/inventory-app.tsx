"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Role = "kitchen" | "bar" | "owner";
type Area = "Cocina" | "Barra";
type Section = "inventory" | "entry" | "count" | "request" | "history" | "products" | "owner";

type Product = {
  id: number;
  name: string;
  area: Area;
  unit: string;
  internal_code?: string | null;
  provider?: string | null;
  ideal_stock?: number | null;
  image_url?: string | null;
  category_id?: number | null;
  status?: string | null;
  current_quantity: number;
  group_id?: number | null;
};

type PurchaseItem = {
  id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  area: Area;
  responsible: string;
  note: string | null;
  created_at: string;
};

type PurchaseRequest = {
  id: number;
  status: "Abierta" | "Cerrada";
  created_at: string;
  closed_at: string | null;
  items: PurchaseItem[];
};

type Movement = {
  id: number;
  product_name: string;
  area: Area;
  responsible: string;
  type: string;
  previous_quantity: number;
  informed_quantity: number;
  difference: number | null;
  new_quantity: number;
  note: string | null;
  created_at: string;
};

type AppState = {
  products: Product[];
  categories: Array<{ id: number; name: string; created_at: string; updated_at: string }>;
  groups: Array<{ id: number; name: string; sector: string; created_at: string; updated_at: string }>;
  areas: Array<{ id: number; name: string; emoji?: string | null; active: number }>
  openRequest: PurchaseRequest | null;
  movements: Movement[];
  archivedRequestCount: number;
};

const roles: Record<Role, { label: string; short: string; area?: Area }> = {
  kitchen: { label: "Encargado de cocina", short: "Cocina", area: "Cocina" },
  bar: { label: "Encargado de barra", short: "Barra", area: "Barra" },
  owner: { label: "Dueño", short: "Dueño" },
};

const sections: Array<{ id: Section; label: string }> = [
  { id: "inventory", label: "Inventario" },
  { id: "entry", label: "Registrar ingreso" },
  { id: "count", label: "Registrar conteo" },
  { id: "request", label: "Solicitud de compra" },
  { id: "history", label: "Historial" },
  { id: "products", label: "Productos" },
  { id: "areas", label: "Áreas" },
];

const sectionTitles: Record<Section, { title: string; description: string }> = {
  inventory: { title: "Inventario", description: "Cantidades registradas para tu área." },
  entry: { title: "Registrar ingreso", description: "Sumá la mercadería que acaba de ingresar." },
  count: { title: "Registrar conteo", description: "Cargá la cantidad que contaste al finalizar la jornada." },
  request: { title: "Solicitud de compra", description: "Agregá los productos que hace falta comprar." },
  history: { title: "Historial", description: "Revisá los últimos ingresos y conteos registrados." },
  products: { title: "Productos", description: "Mantené la lista simple de productos de tu área." },
  owner: { title: "Faltantes", description: "Revisá lo que hace falta comprar y consultá el stock actual." },
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function InventoryApp() {
  const [role, setRole] = useState<Role>("kitchen");
  const [section, setSection] = useState<Section>("inventory");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [data, setData] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [currentArea, setCurrentArea] = useState<string | null>(roles[role].area ?? null);
  const activeArea = currentArea ?? roles[role].area;
  const responsible = roles[role].label;
  const areaProductsAll = useMemo(() => data?.products.filter((product) => product.area === activeArea) ?? [], [data, activeArea]);
  const areaProducts = useMemo(
    () => areaProductsAll.filter((p) => (p.status ?? "Activo") === "Activo"),
    [areaProductsAll],
  );
  const areaMovements = useMemo(
    () => data?.movements.filter((movement) => movement.area === activeArea) ?? [],
    [data, activeArea],
  );

  async function load() {
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar la información.");
      setData(payload);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "No se pudo cargar la información." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setSection(role === "owner" ? "owner" : "inventory");
    setNotice(null);
  }, [role]);

  useEffect(() => {
    function onOpenAreas() {
      setSection("areas");
    }
    window.addEventListener("openAreas", onOpenAreas as EventListener);
    return () => window.removeEventListener("openAreas", onOpenAreas as EventListener);
  }, []);

  async function post(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo completar la operación.");
      await load();
      setNotice({ type: "success", message: success });
      return true;
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "No se pudo completar la operación." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const heading = sectionTitles[section];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">J</span>
          <span><strong>Juanitos</strong><small>Inventario y compras</small></span>
        </div>

        {role !== "owner" && (
          <nav className="side-nav" aria-label="Secciones principales">
            {sections.map((item) => (
              <button
                type="button"
                key={item.id}
                className={section === item.id ? "nav-item active" : "nav-item"}
                onClick={() => { setSection(item.id); setNotice(null); }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        <div className="sidebar-note">
          <strong>Prototipo de prueba</strong>
          <span>El stock cambia solo con ingresos o conteos.</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{role === "owner" ? "Vista del dueño" : `Área ${activeArea}`}</span>
            <h1>{heading.title}</h1>
            <p>{heading.description}</p>
          </div>
          <label className="role-picker">
            <span>Estoy usando la app como</span>
            <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
              <option value="kitchen">Encargado de cocina</option>
              <option value="bar">Encargado de barra</option>
              <option value="owner">Dueño</option>
            </select>
          </label>
        </header>

        {notice && <div className={`notice ${notice.type}`} role="status">{notice.message}</div>}

        {loading ? (
          <div className="loading-state" role="status">Cargando el inventario…</div>
        ) : !data ? (
          <div className="empty-state"><h2>No pudimos cargar la información</h2><button className="button primary" onClick={() => void load()}>Intentar nuevamente</button></div>
        ) : (
          <div className="content-area">
            {section === "inventory" && <InventorySection products={data.products} groups={data.groups} role={role} activeArea={activeArea} areas={data.areas} onSelectArea={(area) => { setCurrentArea(area); setSelectedProductId(null); setSection("products"); }} onAction={(s) => { setSelectedProductId(null); setSection(s); setNotice(null); }} />}
            {section === "areas" && role === "owner" && <AdminAreasSection data={data} busy={busy} post={post} />}
            {section === "entry" && <StockActionSection mode="entry" products={areaProducts} responsible={responsible} busy={busy} post={post} preselectProductId={selectedProductId} />}
            {section === "count" && <CountFlow products={areaProductsAll} groups={data.groups} responsible={responsible} busy={busy} post={post} />}
            {section === "request" && <RequestSection data={data} products={areaProducts} responsible={responsible} busy={busy} post={post} />}
            {section === "history" && <HistorySection movements={areaMovements} />}
            {section === "products" && <ProductsSection products={areaProductsAll} area={activeArea!} busy={busy} post={post} onAction={(s, pid) => { setSelectedProductId(pid ?? null); setSection(s); setNotice(null); }} categories={data?.categories ?? []} groups={data?.groups ?? []} areas={data?.areas ?? []} />}
            {section === "owner" && <OwnerDashboard data={data} />}
          </div>
        )}
      </section>
    </main>
  );
}

function InventorySection({ products, groups, onAction, role, activeArea, areas, onSelectArea }: { products: Product[]; groups: Array<{ id: number; name: string; sector: string }>; onAction: (section: Section) => void; role: Role; activeArea?: Area | undefined; areas: Array<{ id: number; name: string; emoji?: string | null; active: number }>; onSelectArea: (areaName: string) => void }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [selectedAreaLocal, setSelectedAreaLocal] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");

  // Determine visible products according to role/area permissions or selected area
  const visibleProducts = useMemo(() => {
    const areaToUse = selectedAreaLocal ?? activeArea;
    if (role === "owner") return products.filter((p) => (areaToUse ? p.area === areaToUse : true));
    if (!areaToUse) return products.filter((p) => p.area === activeArea);
    return products.filter((p) => p.area === areaToUse);
  }, [products, role, activeArea, selectedAreaLocal]);

  const groupsById = useMemo(() => {
    const m = new Map<number, { id: number; name: string; sector: string }>();
    for (const g of groups) m.set(g.id, g);
    return m;
  }, [groups]);

  // Build sectors -> groups -> products structure
  const sectors = useMemo(() => {
    const sMap = new Map<string, Map<number|null, Product[]>>();
    // ensure sectors from groups
    for (const g of groups) {
      if (!sMap.has(g.sector)) sMap.set(g.sector, new Map());
      const grp = sMap.get(g.sector)!;
      if (!grp.has(g.id)) grp.set(g.id, []);
    }
    // add products into corresponding sector/group (fallback to product.area and null group)
    for (const p of visibleProducts) {
      const grp = p.group_id ?? null;
      const groupObj = grp ? groupsById.get(grp) : null;
      const sectorKey = groupObj ? groupObj.sector : p.area;
      if (!sMap.has(sectorKey)) sMap.set(sectorKey, new Map());
      const target = sMap.get(sectorKey)!;
      if (!target.has(grp)) target.set(grp, []);
      target.get(grp)!.push(p);
    }
    return sMap;
  }, [groups, visibleProducts, groupsById]);

  function toggleGroup(sector: string, groupId: number | null) {
    const key = `${sector}:${groupId ?? "nogroup"}`;
    setOpenGroups((s) => ({ ...s, [key]: !s[key] }));
  }

  function isLowStock(p: Product) {
    return typeof p.ideal_stock === "number" && p.current_quantity < p.ideal_stock;
  }

  // If no area selected, show areas menu
  const activeAreas = areas.filter((a) => a.active === 1);
  if (!selectedAreaLocal && role !== "owner") {
    return (
      <div className="areas-grid">
        <h2>Seleccioná un área</h2>
        <div className="area-buttons">
          {activeAreas.map((a) => (
            <button key={a.id} className="area-card" onClick={() => { setSelectedAreaLocal(a.name); onSelectArea(a.name); }}>
              <div className="area-emoji">{a.emoji ?? "📦"}</div>
              <div className="area-name">{a.name}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="action-row">
        <button className="button primary" onClick={() => onAction("count")}>Registrar conteo</button>
        <button className="button secondary" onClick={() => onAction("entry")}>Registrar ingreso</button>
        {selectedAreaLocal && <button className="link" onClick={() => { setSelectedAreaLocal(null); setOpenGroups({}); onSelectArea(null); }}>← Volver a áreas</button>}
      </div>

      <div className="search-row">
        <label className="search-box"><input placeholder="🔍 Buscar producto" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      </div>

      {[...sectors.entries()].map(([sector, grpMap]) => {
        // apply search filter within this sector
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const any = Array.from(grpMap.values()).some((arr) =>
            arr.some((p) => p.name.toLowerCase().includes(q))
          );
          if (!any) return null;
        }

        return (
          <section className="panel sector-panel" key={sector}>
            <div className="panel-heading">
              <div>
                <h2>{sector}</h2>
                <p>{Array.from(grpMap.values()).reduce((s, arr) => s + arr.length, 0)} productos</p>
              </div>
            </div>

            <div className="groups-list">
              {Array.from(grpMap.entries()).map(([groupId, productsInGroup]) => {
                const group = groupId ? groupsById.get(groupId) : null;
                const key = `${sector}:${groupId ?? "nogroup"}`;
                const open = !!openGroups[key];
                const title = group ? group.name : "Sin grupo";
                return (
                  <div className="group-block" key={key}>
                    <button type="button" className="group-toggle" onClick={() => toggleGroup(sector, groupId)}>
                      <span className="chev">{open ? "▼" : "▶"}</span>
                      <span className="group-title">
                        {title} — {productsInGroup.length} {productsInGroup.length === 1 ? "producto" : "productos"}
                      </span>
                    </button>

                    {open && (
                      <div className="group-contents">
                        {productsInGroup.map((p) => (
                          <article className="stock-row" key={p.id}>
                            <div className="stock-main">
                              <div className="stock-name">{p.name}</div>
                              <div className="stock-meta">
                                <strong>{formatNumber(p.current_quantity)}</strong> <small>{p.unit}</small>
                              </div>
                            </div>
                            <div className="stock-status">
                              {isLowStock(p) ? (
                                <span className="low">⚠️ Stock bajo</span>
                              ) : (
                                <span className="ok">✓ Stock correcto</span>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

function StockActionSection({ mode, products, responsible, busy, post, preselectProductId }: {
  mode: "entry" | "count";
  products: Product[];
  responsible: string;
  busy: boolean;
  post: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
  preselectProductId?: number | null;
}) {
  const [productId, setProductId] = useState<number>(products[0]?.id ?? 0);
  const selected = products.find((product) => product.id === productId) ?? products[0];

  useEffect(() => {
    if (!products.some((product) => product.id === productId)) setProductId(products[0]?.id ?? 0);
  }, [products, productId]);

  useEffect(() => {
    if (preselectProductId && products.some((p) => p.id === preselectProductId)) setProductId(preselectProductId);
  }, [preselectProductId, products]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const ok = await post({
      action: mode === "entry" ? "registerEntry" : "registerCount",
      productId,
      quantity: values.get("quantity"),
      note: values.get("note"),
      responsible,
    }, mode === "entry" ? "Ingreso registrado correctamente." : "Conteo registrado y stock actualizado.");
    if (ok) form.reset();
  }

  if (!products.length) return <Empty message="Primero agregá un producto desde la sección Productos." />;

  return (
    <section className="panel form-panel">
      <div className="form-copy">
        <span className="step-number">1</span>
        <div><h2>{mode === "entry" ? "¿Qué mercadería ingresó?" : "¿Qué producto contaste?"}</h2><p>Elegí un producto de tu área y cargá la cantidad.</p></div>
      </div>
      <form className="simple-form" onSubmit={submit}>
        <label>
          <span>Producto</span>
          <select value={selected?.id ?? 0} onChange={(event) => setProductId(Number(event.target.value))}>
            {products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
          </select>
        </label>
        {selected && <div className="current-stock"><span>Cantidad registrada</span><strong>{formatNumber(selected.current_quantity)} {selected.unit}</strong></div>}
        <label>
          <span>{mode === "entry" ? "Cantidad que ingresó" : "Cantidad contada"}</span>
          <input name="quantity" type="number" min="0" step="0.01" required placeholder="0" />
        </label>
        <label>
          <span>Nota <em>opcional</em></span>
          <textarea name="note" rows={3} placeholder="Agregá una aclaración si hace falta" />
        </label>
        <button className="button primary wide" disabled={busy}>{busy ? "Guardando…" : mode === "entry" ? "Registrar ingreso" : "Registrar conteo"}</button>
      </form>
    </section>
  );
}

function RequestSection({ data, products, responsible, busy, post }: {
  data: AppState;
  products: Product[];
  responsible: string;
  busy: boolean;
  post: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? 0);
  useEffect(() => {
    if (!products.some((product) => product.id === productId)) setProductId(products[0]?.id ?? 0);
  }, [products, productId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const ok = await post({ action: "addPurchaseItem", productId, quantity: values.get("quantity"), note: values.get("note"), responsible }, "Producto agregado a la Solicitud de compra.");
    if (ok) form.reset();
  }

  return (
    <div className="two-column">
      <section className="panel form-panel compact">
        <div className="form-copy"><div><h2>Agregar producto</h2><p>Esto no modifica la cantidad del inventario.</p></div></div>
        {!data.openRequest ? <Empty message="No hay una Solicitud abierta. El dueño puede abrir una nueva." /> : !products.length ? <Empty message="No hay productos disponibles en tu área." /> : (
          <form className="simple-form" onSubmit={submit}>
            <label><span>Producto</span><select value={productId} onChange={(event) => setProductId(Number(event.target.value))}>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · {product.unit}</option>)}</select></label>
            <label><span>Cantidad solicitada</span><input name="quantity" type="number" min="0.01" step="0.01" required /></label>
            <label><span>Nota <em>opcional</em></span><textarea name="note" rows={3} placeholder="Marca, presentación u otra aclaración" /></label>
            <button className="button primary wide" disabled={busy}>{busy ? "Agregando…" : "Agregar a Solicitud"}</button>
          </form>
        )}
      </section>
      <RequestList request={data.openRequest} showDetails />
    </div>
  );
}

function CountFlow({ products, groups, responsible, busy, post }: {
  products: Product[];
  groups: Array<{ id: number; name: string; sector: string; created_at: string; updated_at: string }>;
  responsible: string;
  busy: boolean;
  post: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  const sectors = Array.from(new Set(groups.map((g) => g.sector)));
  const [sector, setSector] = useState<string>(sectors[0] ?? "Cocina");
  const groupsForSector = groups.filter((g) => g.sector === sector);
  const [groupId, setGroupId] = useState<number | null>(groupsForSector[0]?.id ?? null);
  useEffect(() => {
    setGroupId(groupsForSector[0]?.id ?? null);
  }, [sector]);

  const productsInGroup = products.filter((p) => p.group_id && groupId ? p.group_id === groupId : false);
  const [values, setValues] = useState<Record<number, string>>({});

  function setValue(productId: number, value: string) {
    setValues((v) => ({ ...v, [productId]: value }));
  }

  async function saveAll() {
    const counts = Object.entries(values)
      .map(([k, v]) => ({ productId: Number(k), quantity: Number(v) }))
      .filter((c) => Number.isFinite(c.quantity));
    if (!counts.length) return;
    await post({ action: "registerCounts", counts, responsible, groupId }, "Conteo guardado y movimientos registrados.");
    setValues({});
  }

  return (
    <section className="panel form-panel">
      <div className="form-copy">
        <span className="step-number">1</span>
        <div><h2>Registrar conteo por grupos</h2><p>Seleccioná sector y grupo de conteo, cargá las cantidades y guardá.</p></div>
      </div>

      <div className="simple-form">
        <label>
          <span>Sector</span>
          <select value={sector} onChange={(e) => setSector(e.target.value)}>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label>
          <span>Grupo de conteo</span>
          <select value={groupId ?? 0} onChange={(e) => setGroupId(Number(e.target.value) || null)}>
            <option value={0}>-- Seleccioná un grupo --</option>
            {groupsForSector.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>

        {!productsInGroup.length ? (
          <Empty message="No hay productos asignados a este grupo." />
        ) : (
          <div className="product-list">
            {productsInGroup.map((p) => (
              <div key={p.id} className="product-row">
                <div className="product-info"><strong>{p.name}</strong><small>{formatNumber(p.current_quantity)} {p.unit}</small></div>
                <div className="product-input"><input type="number" min="0" step="0.01" value={values[p.id] ?? ""} onChange={(e) => setValue(p.id, e.target.value)} placeholder="Cantidad contada" /></div>
              </div>
            ))}
            <button className="button primary wide" disabled={busy} onClick={() => void saveAll()}>{busy ? "Guardando…" : "Guardar conteo"}</button>
          </div>
        )}
      </div>
    </section>
  );
}

function OwnerDashboard({ data }: { data: AppState }) {
  const [showStockReport, setShowStockReport] = useState(false);
  const missingItems = data.openRequest?.items ?? [];

  return (
    <>
      <section className="panel request-panel">
        <div className="panel-heading">
          <div><h2>Faltantes</h2><p>{missingItems.length ? "Productos que el equipo indicó para comprar." : "No hay productos faltantes informados."}</p></div>
          <span className="status-chip">{missingItems.length} {missingItems.length === 1 ? "producto" : "productos"}</span>
        </div>
        {!missingItems.length ? <Empty message="Cuando Cocina o Barra agreguen un producto a la Solicitud de compra, aparecerá aquí." /> : (
          <div className="request-list">
            {missingItems.map((item) => (
              <article key={item.id} className="request-item">
                <div><strong>{item.product_name}</strong><span>{item.area}</span>{item.note && <small>{item.note}</small>}</div>
                <b>{formatNumber(item.quantity)}</b>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="owner-actions">
        <button className="button secondary" onClick={() => setShowStockReport((visible) => !visible)}>
          {showStockReport ? "Ocultar informe de stock" : "Ver informe de stock"}
        </button>
      </div>

      {showStockReport && <StockReport products={data.products} />}
    </>
  );
}

function StockReport({ products }: { products: Product[] }) {
  return (
    <section className="panel">
      <div className="panel-heading"><div><h2>Informe de stock actual</h2><p>Existencias registradas en Cocina y Barra.</p></div></div>
      {!products.length ? <Empty message="Todavía no hay productos registrados." /> : (
        <div className="table-wrap"><table><thead><tr><th>Área</th><th>Producto</th><th>Stock</th><th>Unidad</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.area}</td><td><strong>{product.name}</strong></td><td>{formatNumber(product.current_quantity)}</td><td>{product.unit}</td></tr>)}</tbody></table></div>
      )}
    </section>
  );
}

function OwnerSection({ data, busy, post }: {
  data: AppState;
  busy: boolean;
  post: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  return (
    <>
      <div className="owner-summary">
        <div><span>Solicitud actual</span><strong>{data.openRequest ? `#${data.openRequest.id}` : "Sin solicitud abierta"}</strong></div>
        <div><span>Productos solicitados</span><strong>{data.openRequest?.items.length ?? 0}</strong></div>
      </div>
      <RequestList request={data.openRequest} />
      <div className="owner-actions">
        {data.openRequest ? (
          <button className="button primary" disabled={busy} onClick={() => void post({ action: "closeRequest" }, "Solicitud cerrada y archivada.")}>{busy ? "Cerrando…" : "Cerrar Solicitud"}</button>
        ) : (
          <button className="button primary" disabled={busy} onClick={() => void post({ action: "openRequest" }, "Nueva Solicitud de compra abierta.")}>{busy ? "Abriendo…" : "Abrir nueva Solicitud"}</button>
        )}
        <span>{data.archivedRequestCount} solicitudes archivadas</span>
        <button className="button secondary" onClick={() => (window as any).setTimeout(() => { const ev = new Event('openAreas'); window.dispatchEvent(ev); }, 0)}>Áreas de inventario</button>
      </div>
    </>
  );
}

function RequestList({ request, showDetails = false }: { request: PurchaseRequest | null; showDetails?: boolean }) {
  return (
    <section className="panel request-panel">
      <div className="panel-heading">
        <div><h2>Solicitud de compra</h2><p>{request ? `Abierta desde ${formatDate(request.created_at)}` : "No hay una Solicitud abierta"}</p></div>
        {request && <span className="status-chip open">Abierta</span>}
      </div>
      {!request || !request.items.length ? <Empty message={request ? "Todavía no se agregaron productos." : "Podés abrir una nueva Solicitud cuando sea necesario."} /> : (
        <div className="request-list">
          {request.items.map((item) => (
            <article key={item.id} className="request-item">
              <div><strong>{item.product_name}</strong><span>{item.area}{showDetails ? ` · ${item.responsible}` : ""}</span>{item.note && <small>{item.note}</small>}</div>
              <b>{formatNumber(item.quantity)}</b>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function HistorySection({ movements }: { movements: Movement[] }) {
  return (
    <section className="panel">
      <div className="panel-heading"><div><h2>Últimos registros</h2><p>Ingresos y conteos de tu área</p></div></div>
      {!movements.length ? <Empty message="Todavía no hay registros." /> : (
        <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Operación</th><th>Anterior</th><th>Informada</th><th>Diferencia</th><th>Nueva</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatDate(movement.created_at)}</td><td><strong>{movement.product_name}</strong><small>{movement.responsible}</small></td><td>{movement.type}{movement.note && <small>{movement.note}</small>}</td><td>{formatNumber(movement.previous_quantity)}</td><td>{formatNumber(movement.informed_quantity)}</td><td className={(movement.difference ?? 0) < 0 ? "negative" : (movement.difference ?? 0) > 0 ? "positive" : ""}>{movement.difference == null ? "—" : `${movement.difference > 0 ? "+" : ""}${formatNumber(movement.difference)}`}</td><td><strong>{formatNumber(movement.new_quantity)}</strong></td></tr>)}</tbody></table></div>
      )}
    </section>
  );
}

function ProductsSection({ products, area, busy, post, onAction, categories, areas }: {
  products: Product[];
  area: Area;
  busy: boolean;
  post: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
  onAction: (section: Section, productId?: number) => void;
  categories: Array<{ id: number; name: string }>;
  groups: Array<{ id: number; name: string; sector: string }>;
  areas: Array<{ id: number; name: string; emoji?: string | null; active: number }>;
}) {
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const ok = await post({
      action: "createProduct",
      name: values.get("name"),
      unit: values.get("unit"),
      quantity: values.get("quantity"),
      area: values.get("area") ?? area,
      internalCode: values.get("internalCode"),
      provider: values.get("provider"),
      idealStock: values.get("idealStock"),
      imageUrl: values.get("imageUrl"),
      categoryId: values.get("categoryId"),
      groupId: values.get("groupId"),
    }, "Producto creado correctamente.");
    if (ok) form.reset();
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = values.get("categoryName");
    if (!name) return;
    await post({ action: "createCategory", name }, "Categoría creada.");
    (event.currentTarget as HTMLFormElement).reset();
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = values.get("groupName");
    const sector = values.get("groupSector");
    if (!name || !sector) return;
    await post({ action: "createCountGroup", name, sector }, "Grupo de conteo creado.");
    (event.currentTarget as HTMLFormElement).reset();
  }

  async function update(event: FormEvent<HTMLFormElement>, product: Product) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    await post({
      action: "updateProduct",
      id: product.id,
      name: values.get("name"),
      unit: values.get("unit"),
      internalCode: values.get("internalCode"),
      provider: values.get("provider"),
      idealStock: values.get("idealStock"),
      imageUrl: values.get("imageUrl"),
      categoryId: values.get("categoryId"),
      area,
    }, "Producto actualizado.");
  }

  return (
    <div className="two-column products-layout">
      <section className="panel form-panel compact">
        <div className="form-copy"><div><h2>Nuevo producto</h2><p>Se agregará al inventario de {area.toLowerCase()}.</p></div></div>
        <form className="simple-form" onSubmit={create}>
          <label><span>Área</span>
            <select name="area" defaultValue={area}>
              {areas.map((a) => <option key={a.id} value={a.name} disabled={a.active !== 1}>{a.name}{a.active !== 1 ? ' (Inactiva)' : ''}</option>)}
            </select>
          </label>
          <label><span>Nombre</span><input name="name" required placeholder="Ej. Pan de hamburguesa" /></label>
          <label><span>Código interno <em>opcional</em></span><input name="internalCode" placeholder="SKU interno" /></label>
          <label><span>Proveedor <em>opcional</em></span><input name="provider" placeholder="Proveedor" /></label>
          <label><span>Unidad de conteo</span><input name="unit" required placeholder="Ej. Bolsa, Kg, Unidad" /></label>
          <label><span>Stock ideal <em>opcional</em></span><input name="idealStock" type="number" min="0" step="0.01" /></label>
          <label><span>Imagen <em>opcional (URL)</em></span><input name="imageUrl" type="url" placeholder="https://..." /></label>
          <label><span>Categoría</span><select name="categoryId"><option value="">— Sin categoría —</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
          <label><span>Grupo de conteo <em>opcional</em></span><select name="groupId"><option value="">— Sin grupo —</option>{groups.map((g) => <option value={g.id} key={g.id}>{g.sector} · {g.name}</option>)}</select></label>
          <label><span>Cantidad inicial</span><input name="quantity" type="number" min="0" step="0.01" defaultValue="0" required /></label>
          <button className="button primary wide" disabled={busy}>Crear producto</button>
        </form>
        <form className="simple-form" onSubmit={createCategory}>
          <label><span>Crear categoría</span><input name="categoryName" placeholder="Ej. Bebidas, Productos secos" /></label>
          <button className="button secondary" disabled={busy}>Crear categoría</button>
        </form>
        <form className="simple-form" onSubmit={createGroup}>
          <label><span>Crear grupo de conteo</span><input name="groupName" placeholder="Ej. Sector A - Pasillo 1" /></label>
          <label><span>Sector</span><input name="groupSector" placeholder="Ej. Cocina, Barra" /></label>
          <button className="button secondary" disabled={busy}>Crear grupo</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Productos de {area.toLowerCase()}</h2><p>Editá propiedades o usá las acciones rápidas</p></div></div>
        <div className="editable-list">
          {products.map((product) => (
            <div key={product.id} className="editable-row">
              <form onSubmit={(event) => void update(event as unknown as FormEvent<HTMLFormElement>, product)}>
                <input name="name" defaultValue={product.name} aria-label={`Nombre de ${product.name}`} required />
                <input name="unit" defaultValue={product.unit} aria-label={`Unidad de ${product.name}`} required />
                <input name="internalCode" defaultValue={product.internal_code ?? ""} placeholder="Código interno" />
                <input name="provider" defaultValue={product.provider ?? ""} placeholder="Proveedor" />
                <input name="idealStock" defaultValue={product.ideal_stock ?? ""} type="number" step="0.01" placeholder="Stock ideal" />
                <input name="imageUrl" defaultValue={product.image_url ?? ""} placeholder="URL imagen" />
                <select name="categoryId" defaultValue={product.category_id ?? ""}><option value="">— Sin categoría —</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
                <select name="groupId" defaultValue={product.group_id ?? ""}><option value="">— Sin grupo —</option>{groups.map((g) => <option value={g.id} key={g.id}>{g.sector} · {g.name}</option>)}</select>
                <span>{formatNumber(product.current_quantity)}</span>
                <div className="row-actions">
                  <button className="text-button" disabled={busy}>Guardar</button>
                  <button type="button" className="text-button" disabled={busy} onClick={() => onAction("history", product.id)}>Historial</button>
                  <button type="button" className="text-button" disabled={busy} onClick={() => onAction("entry", product.id)}>Registrar movimiento</button>
                  <button type="button" className="text-button danger" disabled={busy} onClick={() => { if (window.confirm(`¿Eliminar ${product.name}?`)) void post({ action: "deleteProduct", id: product.id }, "Producto eliminado."); }}>Eliminar</button>
                </div>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminAreasSection({ data, busy, post }: { data: AppState; busy: boolean; post: (p: Record<string, unknown>, s: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState<Record<number, { name: string; emoji?: string | null; active: boolean }>>({});
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of data.products) map.set(p.area, (map.get(p.area) ?? 0) + 1);
    return map;
  }, [data.products]);

  function startEdit(a: { id: number; name: string; emoji?: string | null; active: number }) {
    setEditing((s) => ({ ...s, [a.id]: { name: a.name, emoji: a.emoji ?? null, active: a.active === 1 } }));
  }

  async function save(id: number) {
    const v = editing[id];
    if (!v) return;
    await post({ action: "updateArea", id, name: v.name, emoji: v.emoji, active: v.active }, "Área actualizada");
    setEditing((s) => { const c = { ...s }; delete c[id]; return c; });
  }

  return (
    <section className="panel">
      <div className="panel-heading"><div><h2>Áreas de inventario</h2><p>Crear, editar y activar/inactivar áreas</p></div></div>
      <div className="admin-areas">
        <form className="simple-form" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget as HTMLFormElement); await post({ action: 'createArea', name: f.get('name'), emoji: f.get('emoji') }, 'Área creada'); (e.currentTarget as HTMLFormElement).reset(); }}>
          <label><span>Nombre</span><input name="name" required /></label>
          <label><span>Emoji</span><input name="emoji" /></label>
          <button className="button primary" disabled={busy}>Crear área</button>
        </form>

        <div className="areas-table">
          <table>
            <thead><tr><th>Área</th><th>Productos</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {data.areas.map((a) => (
                <tr key={a.id}>
                  <td>{editing[a.id] ? <input value={editing[a.id].name} onChange={(e) => setEditing((s) => ({ ...s, [a.id]: { ...s[a.id], name: e.target.value } }))} /> : (<><span>{a.emoji ?? ''}</span> <strong>{a.name}</strong></>)}</td>
                  <td>{counts.get(a.name) ?? 0}</td>
                  <td>{a.active === 1 ? 'Activa' : 'Inactiva'}</td>
                  <td>
                    {editing[a.id] ? (
                      <>
                        <button className="text-button" onClick={() => void save(a.id)}>Guardar</button>
                        <button className="text-button" onClick={() => setEditing((s) => { const c = { ...s }; delete c[a.id]; return c; })}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button className="text-button" onClick={() => startEdit(a)}>Editar</button>
                        <button className="text-button" onClick={async () => { await post({ action: 'toggleArea', id: a.id }, 'Estado actualizado'); }}>Alternar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="empty-inline">{message}</div>;
}
