"use client";
import { useMemo, useState } from "react";
import type { CatalogCategoryDto, CatalogProductDto, CatalogVariantDto } from "@/lib/pos2/ui/types";
import { filterCatalogProducts, nextCatalogLimit } from "@/lib/pos2/ui/catalog";

export type CatalogSelection={product:CatalogProductDto;variant:CatalogVariantDto|null};
const price=(value:string|null)=>value?new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(value)):"Sin precio";
export default function CatalogPanel({categories,disabled,onSelect}:{categories:CatalogCategoryDto[];disabled:boolean;onSelect:(selection:CatalogSelection)=>void}){
  const [category,setCategory]=useState("ALL"),[query,setQuery]=useState(""),[limit,setLimit]=useState(48),[variantProduct,setVariantProduct]=useState<CatalogProductDto|null>(null);
  const products=useMemo(()=>filterCatalogProducts(categories,category,query),[categories,category,query]);
  function choose(product:CatalogProductDto){if(product.variants.length){setVariantProduct(product);return;}onSelect({product,variant:null});}
  return <section className="pos2-catalog" aria-label="Catálogo">
    <div className="pos2-search"><span aria-hidden>⌕</span><input data-testid="catalog-search" value={query} onChange={event=>{setQuery(event.target.value);setLimit(48)}} placeholder="Buscar producto, SKU o código" autoComplete="off"/><kbd>⌘ K</kbd></div>
    <nav className="pos2-categories" aria-label="Categorías"><button className={category==="ALL"?"active":""} onClick={()=>setCategory("ALL")}>Todos</button>{categories.map(item=><button key={item.id} className={category===item.id?"active":""} onClick={()=>setCategory(item.id)}>{item.icon&&<span>{item.icon}</span>}{item.name}</button>)}</nav>
    <div className="pos2-product-grid" data-testid="product-grid">{products.slice(0,limit).map(product=><button key={product.id} disabled={disabled||!product.available||(!product.price&&!product.variants.some(v=>v.price))} className="pos2-product" onClick={()=>choose(product)}>
      <span className="pos2-product-icon" aria-hidden>{product.icon||product.name.slice(0,1).toUpperCase()}</span><span className="pos2-product-copy"><strong>{product.name}</strong><small>{product.variants.length?`${product.variants.length} opciones`:product.sku||"Producto"}</small></span><b>{product.variants.length?`desde ${price(product.variants.find(v=>v.price)?.price??null)}`:price(product.price)}</b>
    </button>)}</div>
    {!products.length&&<div className="pos2-empty"><b>Sin resultados</b><span>Prueba con otro nombre, SKU o categoría.</span></div>}
    {products.length>limit&&<button className="pos2-more" onClick={()=>setLimit(value=>nextCatalogLimit(value,products.length))}>Mostrar más productos</button>}
    {variantProduct&&<div className="pos2-modal-backdrop" onMouseDown={()=>setVariantProduct(null)}><div className="pos2-modal" role="dialog" aria-modal="true" aria-label={`Elegir ${variantProduct.name}`} onMouseDown={event=>event.stopPropagation()}><div className="pos2-modal-head"><div><small>Elige una presentación</small><h2>{variantProduct.name}</h2></div><button aria-label="Cerrar" onClick={()=>setVariantProduct(null)}>×</button></div><div className="pos2-variant-list">{variantProduct.variants.map(variant=><button key={variant.id} disabled={!variant.available||!variant.price} onClick={()=>{onSelect({product:variantProduct,variant});setVariantProduct(null)}}><span><b>{variant.name}</b><small>{variant.sku||"Disponible"}</small></span><strong>{price(variant.price)}</strong></button>)}</div></div></div>}
  </section>;
}
