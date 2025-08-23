"use client";

import { Image as ImageIcon, Star, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ProductImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  maxFileSize?: number; // in MB
  acceptedFormats?: string[];
}

interface UploadProgress {
  [key: string]: number;
}

export function ProductImageUpload({
  images,
  onImagesChange,
  maxImages = 10,
  maxFileSize = 5,
  acceptedFormats = ["image/jpeg", "image/png", "image/webp"],
}: ProductImageUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "product");

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(_error.message || "Upload failed");
    }

    const result = await response.json();
    return result.url;
  };

  // Validate file
  const validateFile = (file: File): string | null => {
    if (!acceptedFormats.includes(file.type)) {
      return `Invalid file format. Please use: ${acceptedFormats.map((f) => f.split("/")[1]).join(", ")}`;
    }

    if (file.size > maxFileSize * 1024 * 1024) {
      return `File size too large. Maximum size: ${maxFileSize}MB`;
    }

    return null;
  };

  // Handle file selection
  const handleFiles = useCallback(
    async (files: FileList) => {
      const fileArray = Array.from(files);

      if (images.length + fileArray.length > maxImages) {
        toast.error(`Maximum ${maxImages} images allowed`);
        return;
      }

      setUploading(true);
      const newImages: string[] = [];

      try {
        for (const file of fileArray) {
          const validationError = validateFile(file);
          if (validationError) {
            toast.error(validationError);
            continue;
          }

          try {
            // Simulate upload progress
            const progressKey = file.name;
            setUploadProgress((prev) => ({ ...prev, [progressKey]: 0 }));

            // Simulate progress updates
            const progressInterval = setInterval(() => {
              setUploadProgress((prev) => {
                const current = prev[progressKey] || 0;
                if (current < 90) {
                  return { ...prev, [progressKey]: current + 10 };
                }
                return prev;
              });
            }, 100);

            const imageUrl = await uploadFile(file);
            newImages.push(imageUrl);

            // Complete progress
            clearInterval(progressInterval);
            setUploadProgress((prev) => ({ ...prev, [progressKey]: 100 }));

            // Remove progress after a delay
            setTimeout(() => {
              setUploadProgress((prev) => {
                const updated = { ...prev };
                delete updated[progressKey];
                return updated;
              });
            }, 1000);
          } catch (_error) {
            console.error("Error uploading file:", _error);
            toast.error(`Failed to upload ${file.name}`);
          }
        }

        if (newImages.length > 0) {
          onImagesChange([...images, ...newImages]);
          toast.success(`${newImages.length} image(s) uploaded successfully`);
        }
      } finally {
        setUploading(false);
      }
    },
    [images, maxImages, onImagesChange]
  );

  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Handle file input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
    toast.success("Image removed");
  };

  // Move image
  const moveImage = (fromIndex: number, toIndex: number) => {
    const newImages = [...images];
    const [removed] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, removed);
    onImagesChange(newImages);
  };

  // Set as primary image (move to first position)
  const setPrimaryImage = (index: number) => {
    if (index === 0) return;
    moveImage(index, 0);
    toast.success("Primary image updated");
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
      >
        <CardContent className="p-6">
          <div
            className="text-center"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="text-muted-foreground mx-auto mb-4 h-12 w-12">
              <Upload className="h-full w-full" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Drop images here or click to upload
              </p>
              <p className="text-muted-foreground text-xs">
                PNG, JPG, WebP up to {maxFileSize}MB each (max {maxImages}{" "}
                images)
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || images.length >= maxImages}
            >
              Choose Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedFormats.join(",")}
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="mb-2 text-sm font-medium">Uploading...</h4>
            <div className="space-y-2">
              {Object.entries(uploadProgress).map(([filename, progress]) => (
                <div key={filename} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="truncate">{filename}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              Product Images ({images.length}/{maxImages})
            </h4>
            {images.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Drag to reorder • First image is the primary image
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {images.map((image, index) => (
              <Card key={index} className="group relative overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative aspect-square">
                    <img
                      src={image}
                      alt={`Product image ${index + 1}`}
                      className="h-full w-full object-cover"
                    />

                    {/* Primary Badge */}
                    {index === 0 && (
                      <Badge className="bg-primary text-primary-foreground absolute top-2 left-2">
                        <Star className="mr-1 h-3 w-3" />
                        Primary
                      </Badge>
                    )}

                    {/* Actions Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="absolute top-2 right-2 flex gap-1">
                        {index !== 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-6 w-6 p-0"
                            onClick={() => setPrimaryImage(index)}
                            title="Set as primary image"
                          >
                            <Star className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-6 w-6 p-0"
                          onClick={() => removeImage(index)}
                          title="Remove image"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Move buttons */}
                      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 transform gap-1">
                        {index > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-6 px-2 text-xs"
                            onClick={() => moveImage(index, index - 1)}
                          >
                            ←
                          </Button>
                        )}
                        {index < images.length - 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-6 px-2 text-xs"
                            onClick={() => moveImage(index, index + 1)}
                          >
                            →
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <ImageIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-sm">
              No images uploaded yet. Add some product images to get started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
