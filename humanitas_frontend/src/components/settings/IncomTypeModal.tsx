import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

export interface incomeTypeData {
  name: string;
  taxable: boolean;
  pensionable: boolean;
  taxRate: string;
  customTaxRate: string;
}

interface IncomTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  incomeType?: incomeTypeData;
  onSave: (data: incomeTypeData) => void;
}

export function IncomTypeModal({
  isOpen,
  onClose,
  incomeType,
  onSave,
}: IncomTypeModalProps) {
  const [formData, setFormData] = useState<incomeTypeData>(
    incomeType || {
      name: "",
      taxable: false,
      pensionable: false,
      taxRate: "standard",
      customTaxRate: "",
    }
  );
  const isEditMode = !!incomeType;
  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Income Type" : "Add Income Type"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Modify the details of the income type."
              : "Fill in the details to add a new income type."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="income-type-name">Name</Label>
            <Input
              id="income-type-name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Commission"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="taxable"
              checked={formData.taxable}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, taxable: checked === true })
              }
            />
            <Label
              htmlFor="taxable"
              className="text-sm font-normal cursor-pointer"
            >
              Taxable
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="pensionable"
              checked={formData.pensionable}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, pensionable: checked === true })
              }
            />
            <Label
              htmlFor="pensionable"
              className="text-sm font-normal cursor-pointer"
            >
              Pensionable
            </Label>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tax-rate">Tax Rate</Label>
            <select
              id="tax-rate"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.taxRate}
              onChange={(e) =>
                setFormData({ ...formData, taxRate: e.target.value })
              }
            >
              <option value="standard">Standard Rate</option>
              <option value="0%">0% (Tax Exempt)</option>
              <option value="custom">Custom Rate</option>
            </select>
            {formData.taxRate === "custom" && (
              <div className="mt-2">
                <Input
                  id="custom-tax-rate"
                  type="number"
                  value={formData.customTaxRate}
                  onChange={(e) =>
                    setFormData({ ...formData, customTaxRate: e.target.value })
                  }
                  placeholder="Enter custom tax rate (%)"
                  min={"0"}
                  max={"100"}
                  step={"0.01"}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isEditMode ? "Save Changes" : "Add Income Type"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
