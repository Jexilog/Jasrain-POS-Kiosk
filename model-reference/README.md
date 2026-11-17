# Supplied cart model (reference only)

The supplied `best.onnx` was inspected from `cart_model.zip`. Its metadata identifies it as an Ultralytics YOLO11n object-detection model with one class:

- class 0: `cart`
- training image size: 320 x 320
- task: object detection

This model detects the basket/cart object. It does **not** classify the basket as empty or occupied, and it does not detect the products inside it. Because the requested Jasrain feature is only EMPTY / NOT EMPTY and must run entirely in the browser, the current implementation uses the browser camera plus a saved empty-basket reference image instead. The ONNX file is retained here for future work, but it is intentionally not downloaded or executed by the frontend.

Do not treat detection of class `cart` as evidence that products are present.
