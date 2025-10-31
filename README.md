# simple-aws-file-uploader

A production-ready, minimal service for uploading files to **Amazon S3**, extracting metadata with **AWS Lambda**, and persisting everything in **Amazon DynamoDB**, exposed via an **Express (Serverless HTTP API)**.

- **Upload flow**: Client requests `/upload` → gets a **pre-signed S3 URL** → uploads directly to S3.  
- **Post-upload**: S3 **ObjectCreated** event triggers a Lambda that **extracts metadata** (size, content type; PDF pages; image dimensions) and updates DynamoDB.  
- **Read**: Client queries `/metadata/{file_id}` to fetch both user-provided and system-extracted metadata.

> Runtime: **Node.js 20.x** • Framework: **Serverless Framework v3**

---

## 🧠 Architecture

```
Client -----> /upload (Express on Lambda via API Gateway)
   |                  |
   |                  |--> DynamoDB: create item (status: PENDING_UPLOAD)
   |                  |--> Return file_id + S3 pre-signed PUT URL
   |
   +---- PUT file ----> S3 bucket  (using pre-signed URL)
                         |
                         +--> S3 Event: ObjectCreated -> Lambda extractor
                                  |
                                  +--> Read S3 object, compute metadata
                                  +--> Update DynamoDB (status: EXTRACTED)

Client -----> /metadata/{file_id} (Express) ----> DynamoDB item (user + system metadata)
```

---

## 📁 Folder Structure

```
simple-aws-file-uploader/
├─ serverless.yml                 # Infra & functions (Node 20, IAM, events)
├─ package.json
├─ tsconfig.json
├─ .eslintrc.cjs
├─ src/
│  ├─ api/
│  │  ├─ app.ts                  # Express app (routes: /upload, /metadata/:file_id)
│  │  └─ handler.ts              # serverless-http wrapper
│  ├─ extract/
│  │  ├─ extractor.ts            # S3-triggered logic: read object, parse metadata, update DynamoDB
│  │  └─ handler.ts              # S3 event Lambda handler
│  ├─ services/
│  │  ├─ s3.service.ts           # S3Service: presign, headObject, getObjectStream
│  │  ├─ dynamo.service.ts       # DynamoService: put/get/update/mark error
│  │  └─ id.service.ts           # IdService: file_id + S3 key helpers
│  ├─ types.ts                   # Shared types (StoredItem, UserMetadata)
│  └─ utils.ts                   # (reserved for helpers)
└─ README.md
```

---

## ⚙️ Why These Choices

- **Pre-signed S3 uploads** → avoids API Gateway size limits, improves scalability.
- **S3 event triggers** → decoupled, serverless background metadata extraction.
- **DynamoDB PAY_PER_REQUEST** → automatic scaling and low maintenance.
- **Express + serverless-http** → developer-friendly REST API syntax.
- **Class-based services** → clean, modular, and easy to test.
- **Node.js 20** → modern runtime and long-term support.

---

## ✅ Prerequisites

- AWS account (with CloudFormation deploy permissions)
- Node.js **v20+**
- Serverless Framework **v3+** (`npm i -g serverless`)
- AWS CLI configured (`aws configure`)

---

## 🚀 Setup & Installation

```bash
git clone <your-repo-url> simple-aws-file-uploader
cd simple-aws-file-uploader

npm install
```

---

## ⚙️ Configuration

Edit **`serverless.yml`** as needed:

```yaml
provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  stage: ${opt:stage, 'dev'}
  environment:
    FILES_BUCKET: ${self:service}-${self:provider.stage}-files
    TABLE_NAME: ${self:service}-${self:provider.stage}-files
    PRESIGN_EXPIRES_SECONDS: '900' # 15 min
```

S3 bucket and DynamoDB table are created automatically on deploy.

---

## ☁️ Deploy

```bash
npm run deploy
# or
serverless deploy --stage dev
```

Once complete, Serverless will print your API URL (e.g. `https://xxxx.execute-api.us-east-1.amazonaws.com`).

To remove:

```bash
npm run remove
# or
serverless remove --stage dev
```

---

## 🧩 Local Development

```bash
npm run dev
# Starts serverless-offline at http://localhost:3000
```

> Note: S3 triggers are not simulated locally — test upload flow directly with real AWS resources.

---

## 🔗 API Usage

### 1️⃣ Request Upload URL

**POST** `/upload`

```json
{
  "filename": "document.pdf",
  "contentType": "application/pdf",
  "userMetadata": {
    "author": "Alice",
    "expiresAt": "2026-01-01T00:00:00.000Z",
    "tags": ["legal", "contract"]
  }
}
```

**Response:**

```json
{
  "file_id": "8e0e1d6c-3b0b-4a2f-8f0d-e7f8f2d3c9ab",
  "upload_url": "https://s3.amazonaws.com/...signature...",
  "bucket": "simple-aws-file-uploader-dev-files",
  "key": "8e0e1d6c.../document.pdf",
  "instructions": "Perform an HTTP PUT to the 'upload_url' with the specified Content-Type."
}
```

### 2️⃣ Upload the File

```bash
curl -X PUT -H "Content-Type: application/pdf"   --data-binary @document.pdf   "PASTE_UPLOAD_URL_HERE"
```

### 3️⃣ Retrieve Metadata

**GET** `/metadata/{file_id}`

**Response Example:**

```json
{
  "file_id": "8e0e1d6c-3b0b-4a2f-8f0d-e7f8f2d3c9ab",
  "status": "EXTRACTED",
  "userMetadata": {
    "author": "Alice",
    "expiresAt": "2026-01-01T00:00:00.000Z"
  },
  "systemMetadata": {
    "size": 314572,
    "mimeType": "application/pdf",
    "pages": 12,
    "sha256": "..."
  },
  "createdAt": "2025-10-30T19:00:00.000Z",
  "updatedAt": "2025-10-30T19:00:10.000Z"
}
```

---

## 🧾 Metadata Extraction Details

- Extracts **size**, **mimeType**, and **sha256** for all files.
- If **PDF** → counts `pages` via `pdf-parse`.
- If **image** → extracts `width` and `height` via `image-size`.

Packages used:
- `@aws-sdk/*` for S3/DynamoDB
- `pdf-parse` for PDFs
- `image-size` for images
- `zod` for input validation

---

## 🔒 Security & IAM

- S3 bucket is **private**. Clients only get **time-limited pre-signed URLs** (default 15 min).
- CORS allows all origins by default — update `AllowedOrigins` for your domain.
- IAM grants only necessary actions:
  - S3: `PutObject`, `GetObject`, `HeadObject`, `ListBucket`
  - DynamoDB: `PutItem`, `GetItem`, `UpdateItem`

---

## 🧰 Troubleshooting

| Issue | Solution |
|-------|-----------|
| **VSCode YAML BucketName error** | Fixed using `Fn::Sub` in `serverless.yml` for schema compliance. |
| **Lambda not triggered after upload** | Verify `ObjectCreated:Put` event and check CloudWatch logs. |
| **CORS errors in browser** | Adjust `CorsConfiguration` in bucket and ensure consistent `Content-Type`. |
| **Cannot delete stack** | Empty S3 bucket before running `serverless remove`. |

---

## 🧼 Cleanup

```bash
npm run remove
```

Removes API Gateway, Lambdas, DynamoDB, and S3 resources (must be empty).

---

## 🛠️ Roadmap / Next Steps

- Add authentication (JWT/Cognito)
- Multi-tenant support with `tenant_id` and RLS
- Integrate virus scanning (ClamAV, Lambda Layer)
- Add OCR/Textract for scanned PDFs
- Enable lifecycle rules (move old files to Glacier)
- Add structured logs and metrics (X-Ray, CloudWatch Insights)

---

## 📄 License
GPL-3.0 license
