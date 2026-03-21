import { useState, useEffect } from "react";
import { Package, Plus, Search, Edit, Trash2, IndianRupee } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Badge } from "@/ui/shadcn/badge";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/modules/cpq/hooks/useCPQ";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/shadcn/dialog";
import { Label } from "@/ui/shadcn/label";
import { Textarea } from "@/ui/shadcn/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/shadcn/select";
import type { Product } from "@/core/types/cpq";

const categories = [
  "CPQ",
  "CLM",
  "CRM",
  "E-Signature",
  "Analytics",
  "Integration",
  "Documents",
  "Bundle",
];

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  // Controlled form state for dialog (ensures values are submitted reliably)
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formCategory, setFormCategory] = useState<string>("CPQ");
  const [formUnitPrice, setFormUnitPrice] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");

  const { data: products, isLoading } = useProducts();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  // Sync controlled form state when dialog opens or editingProduct changes
  useEffect(() => {
    if (isDialogOpen) {
      if (editingProduct) {
        setFormName(editingProduct.name || "");
        setFormSku(editingProduct.sku || "");
        setFormCategory(editingProduct.category || "CPQ");
        setFormUnitPrice(
          editingProduct.unit_price != null
            ? String(editingProduct.unit_price)
            : ""
        );
        setFormDescription(editingProduct.description || "");
      } else {
        setFormName("");
        setFormSku("");
        setFormCategory("CPQ");
        setFormUnitPrice("");
        setFormDescription("");
      }
    }
  }, [isDialogOpen, editingProduct]);

  const filteredProducts = products?.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const product = {
      name: formName,
      sku: formSku,
      description: formDescription,
      unit_price: parseFloat(formUnitPrice || "0"),
      category: formCategory,
      is_active: true,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, ...product }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingProduct(null);
        },
      });
    } else {
      createMutation.mutate(product, {
        onSuccess: () => {
          setIsDialogOpen(false);
        },
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(value);
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-3xl font-semibold">
              Product Catalog
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Manage your products and pricing
            </p>
          </div>

          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setEditingProduct(null);
            }}
          >
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  // ensure form is reset when opening add dialog
                  setEditingProduct(null);
                }}
              >
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Add Product</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="hidden" name="category" value={formCategory} />
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    name="sku"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formCategory}
                    onValueChange={(val: string) => setFormCategory(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_price">Price (₹/user/month)</Label>
                  <Input
                    id="unit_price"
                    name="unit_price"
                    type="number"
                    step="0.01"
                    value={formUnitPrice}
                    onChange={(e) => setFormUnitPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editingProduct ? "Update" : "Create"} Product
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            {/* changed top-1/2 to top-5 for  */}
            <Search className="absolute left-3 top-5 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-48" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts?.map((product) => (
              <Card
                key={product.id}
                className="group transition-all hover:shadow-lg rounded-xl"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* changed icon container smaller on mobile, normal on desktop  */}
                      <div className="h-9 w-9 md:h-10 md:w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        {/* same changes to make it responsive */}
                        <Package className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      </div>

                      <div className="leading-tight">
                        {/* text mid on mobile devices */}
                        <CardTitle className="text-base md:text-lg font-semibold">
                          {product.name}
                        </CardTitle>
                        {/* same changes */}
                        <p className="text-[11px] md:text-xs text-muted-foreground">
                          {product.sku}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant={product.is_active ? "default" : "secondary"}
                      className="text-[11px] md:text-xs"
                    >
                      {product.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* reduced vertical spacing for compact mobile feel  */}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <IndianRupee className="h-4 w-4 text-primary" />
                      {/* price smaller on mobile */}
                      <span className="text-lg md:text-xl font-semibold">
                        {formatCurrency(product.unit_price)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {/* price text smaller on mobile */}
                        /user/mo
                      </span>
                    </div>
                    {/* badge text scaled down on mobile */}
                    <Badge variant="outline" className="text-[11px] md:text-xs">
                      {product.category}
                    </Badge>
                  </div>

                  {/* Actions */}
                  {/* Changed:
                      - Buttons ALWAYS visible on mobile (no hover on touch devices)
                      - Hover-based fade-in kept only for desktop */}
                  <div className="flex gap-2 pt-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8"
                      onClick={() => {
                        setEditingProduct(product);
                        setIsDialogOpen(true);
                      }}
                    >
                      {/* compact on mobile */}
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                      {/* compact square delete button for mobile */}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        if (confirm(`Delete ${product.name}? This action cannot be undone.`)) {
                          deleteMutation.mutate(product.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredProducts?.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No products found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>
  );
}
