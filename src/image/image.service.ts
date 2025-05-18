import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'
import axios from 'axios'
import { Readable } from 'stream'

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name)
  private blobServiceClient: BlobServiceClient
  private containerClient: ContainerClient
  private azureBlobStorageConnectionString: string
  private azureBlobStorageContainerName: string

  constructor(private configService: ConfigService) {
    const connectionString = this.configService.get<string>(
      'AZURE_STORAGE_CONNECTION_STRING',
    )
    const containerName = this.configService.get<string>(
      'AZURE_STORAGE_CONTAINER_NAME',
    )

    if (!connectionString) {
      this.logger.error(
        'Azure Blob Storage connection string is not configured.',
      )
      throw new Error('Azure Blob Storage connection string is not configured.')
    }
    this.azureBlobStorageConnectionString = connectionString

    if (!containerName) {
      this.logger.error('Azure Blob Storage container name is not configured.')
      throw new Error('Azure Blob Storage container name is not configured.')
    }
    this.azureBlobStorageContainerName = containerName

    try {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(
        this.azureBlobStorageConnectionString,
      )
      this.containerClient = this.blobServiceClient.getContainerClient(
        this.azureBlobStorageContainerName,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(
        `Failed to initialize Azure BlobServiceClient or ContainerClient: ${message}`,
        error instanceof Error ? error.stack : undefined,
      )
      throw new Error(
        `Failed to initialize Azure BlobServiceClient or ContainerClient: ${message}`,
      )
    }
  }

  private async ensureContainerExists(): Promise<void> {
    try {
      const exists = await this.containerClient.exists()
      if (!exists) {
        this.logger.log(
          `Container "${this.azureBlobStorageContainerName}" does not exist. Creating...`,
        )
        await this.containerClient.create({ access: 'blob' }) // Public access for blobs
        this.logger.log(
          `Container "${this.azureBlobStorageContainerName}" created successfully.`,
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(
        `Error ensuring container exists: ${message}`,
        error instanceof Error ? error.stack : undefined,
      )
      // Depending on the error, we might want to throw it or handle it
      // For now, rethrowing to indicate a critical setup failure
      throw new Error(`Failed to ensure Azure container exists: ${message}`)
    }
  }

  async uploadImageFromBuffer(
    buffer: Buffer,
    blobName: string,
    contentType = 'image/jpeg',
  ): Promise<string> {
    await this.ensureContainerExists() // Added await
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
    try {
      // Convert Buffer to ReadableStream for uploadStream
      const stream = new Readable()
      stream.push(buffer)
      stream.push(null) // Signifies end of stream

      await blockBlobClient.uploadStream(
        stream,
        undefined, // bufferSize: Use default
        undefined, // maxBuffers: Use default
        {
          blobHTTPHeaders: { blobContentType: contentType },
        },
      )
      this.logger.log(
        `Image buffer uploaded successfully to Azure Blob Storage: ${blobName}`,
      )
      return blockBlobClient.url
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(
        `Error uploading image buffer to Azure Blob Storage: ${message}`,
        error instanceof Error ? error.stack : undefined,
      )
      throw new Error(
        `Failed to upload image buffer to Azure: ${blobName}. Error: ${message}`,
      )
    }
  }

  async uploadImageFromUrl(
    imageUrl: string,
    blobName: string,
  ): Promise<string> {
    await this.ensureContainerExists() // Added await
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      })
      // Explicitly cast response.data to Buffer
      const buffer = Buffer.from(response.data as ArrayBuffer)
      const contentType =
        (response.headers['content-type'] as string) || 'image/jpeg' // Assert as string and provide fallback

      return await this.uploadImageFromBuffer(buffer, blobName, contentType)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(
        `Error uploading image from URL ${imageUrl} to Azure Blob Storage: ${message}`,
        error instanceof Error ? error.stack : undefined,
      )
      throw new Error(
        `Failed to upload image from URL to Azure: ${blobName}. Error: ${message}`,
      )
    }
  }

  async deleteImage(blobName: string): Promise<void> {
    await this.ensureContainerExists() // Added await
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
    try {
      await blockBlobClient.delete()
      this.logger.log(
        `Image deleted successfully from Azure Blob Storage: ${blobName}`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(
        `Error deleting image from Azure Blob Storage: ${message}`,
        error instanceof Error ? error.stack : undefined,
      )
      // Decide if this should throw an error or just log if deletion fails (e.g., blob not found)
      // For now, throwing to indicate potential issues.
      throw new Error(
        `Failed to delete image from Azure: ${blobName}. Error: ${message}`,
      )
    }
  }

  async getImageBufferFromUrl(imageUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      })
      // Explicitly cast response.data to Buffer
      const buffer = Buffer.from(response.data as ArrayBuffer)
      this.logger.log(`Image buffer fetched successfully from URL: ${imageUrl}`)
      return buffer
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(
        `Error fetching image buffer from URL ${imageUrl}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      )
      throw new Error(
        `Failed to fetch image buffer from URL: ${imageUrl}. Error: ${message}`,
      )
    }
  }
}
