/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AzureOpenAI } from 'openai'
import { APIError } from 'openai/error'
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionChunk,
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
} from 'openai/resources/index.mjs'
import { DefaultAzureCredential } from '@azure/identity'

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name)
  private chatClientGpt4: AzureOpenAI | null = null
  private chatClientGpt35: AzureOpenAI | null = null
  private embeddingClient: AzureOpenAI | null = null

  private readonly azureOpenAIApiEndpoint: string
  private readonly azureOpenAIApiVersion: string
  private readonly azureOpenAIEmbeddingApiVersion: string
  private readonly azureOpenAIDeploymentNameGpt4: string | undefined
  private readonly azureOpenAIDeploymentNameGpt35: string | undefined
  private readonly azureOpenAIEmbeddingDeploymentName: string | undefined

  constructor(private readonly configService: ConfigService) {
    this.azureOpenAIApiEndpoint = this.configService.get<string>(
      'AZURE_OPENAI_ENDPOINT',
    )!
    this.azureOpenAIApiVersion = this.configService.get<string>(
      'AZURE_OPENAI_API_VERSION',
    )!
    this.azureOpenAIEmbeddingApiVersion =
      this.configService.get<string>('AZURE_OPENAI_EMBEDDING_API_VERSION') ||
      '2023-05-15'

    this.azureOpenAIDeploymentNameGpt4 = this.configService.get<string>(
      'AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1',
    )
    this.azureOpenAIDeploymentNameGpt35 = this.configService.get<string>(
      'AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_MINI',
    )
    this.azureOpenAIEmbeddingDeploymentName = this.configService.get<string>(
      'AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME',
    )

    if (!this.azureOpenAIApiEndpoint) {
      this.logger.error('AZURE_OPENAI_ENDPOINT is not configured.')
      throw new Error('Azure OpenAI API endpoint is not configured.')
    }
    if (!this.azureOpenAIApiVersion) {
      this.logger.error('AZURE_OPENAI_API_VERSION is not configured.')
      throw new Error('Azure OpenAI API version is not configured.')
    }

    const tokenCredential = new DefaultAzureCredential()

    if (this.azureOpenAIDeploymentNameGpt4) {
      this.chatClientGpt4 = new AzureOpenAI({
        endpoint: this.azureOpenAIApiEndpoint,
        apiVersion: this.azureOpenAIApiVersion,
        deployment: this.azureOpenAIDeploymentNameGpt4,
        azureADTokenProvider: async () => {
          const accessToken = await tokenCredential.getToken(
            'https://cognitiveservices.azure.com/.default',
          )
          if (!accessToken)
            throw new Error('Failed to get token from DefaultAzureCredential')
          return accessToken.token
        },
      })
      this.logger.log(
        `AzureOpenAI client initialized for GPT-4: ${this.azureOpenAIDeploymentNameGpt4} using Entra ID`,
      )
    } else {
      this.logger.warn(
        'AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1 is not configured. GPT-4 client will not be available.',
      )
    }

    if (this.azureOpenAIDeploymentNameGpt35) {
      this.chatClientGpt35 = new AzureOpenAI({
        endpoint: this.azureOpenAIApiEndpoint,
        apiVersion: this.azureOpenAIApiVersion,
        deployment: this.azureOpenAIDeploymentNameGpt35,
        azureADTokenProvider: async () => {
          const accessToken = await tokenCredential.getToken(
            'https://cognitiveservices.azure.com/.default',
          )
          if (!accessToken)
            throw new Error('Failed to get token from DefaultAzureCredential')
          return accessToken.token
        },
      })
      this.logger.log(
        `AzureOpenAI client initialized for GPT-3.5 (mini): ${this.azureOpenAIDeploymentNameGpt35} using Entra ID`,
      )
    } else {
      this.logger.warn(
        'AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_MINI is not configured. GPT-3.5 (mini) client will not be available.',
      )
    }

    if (this.azureOpenAIEmbeddingDeploymentName) {
      this.embeddingClient = new AzureOpenAI({
        endpoint: this.azureOpenAIApiEndpoint,
        apiVersion: this.azureOpenAIEmbeddingApiVersion,
        deployment: this.azureOpenAIEmbeddingDeploymentName,
        azureADTokenProvider: async () => {
          const accessToken = await tokenCredential.getToken(
            'https://cognitiveservices.azure.com/.default',
          )
          if (!accessToken)
            throw new Error('Failed to get token from DefaultAzureCredential')
          return accessToken.token
        },
      })
      this.logger.log(
        `AzureOpenAI client initialized for Embeddings: ${this.azureOpenAIEmbeddingDeploymentName} with API version: ${this.azureOpenAIEmbeddingApiVersion} using Entra ID`,
      )
    } else {
      this.logger.warn(
        'AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME is not configured. Embedding client will not be available.',
      )
    }

    if (!this.chatClientGpt4 && !this.chatClientGpt35) {
      this.logger.error(
        'No chat clients (GPT-4 or GPT-3.5) could be initialized. Check deployment name configurations.',
      )
    }
  }

  private getClientByDeploymentName(deploymentName: string): AzureOpenAI {
    if (deploymentName === this.azureOpenAIDeploymentNameGpt4) {
      if (!this.chatClientGpt4) {
        throw new Error(
          `GPT-4 client (${this.azureOpenAIDeploymentNameGpt4}) is not initialized.`,
        )
      }
      return this.chatClientGpt4
    } else if (deploymentName === this.azureOpenAIDeploymentNameGpt35) {
      if (!this.chatClientGpt35) {
        throw new Error(
          `GPT-3.5 client (${this.azureOpenAIDeploymentNameGpt35}) is not initialized.`,
        )
      }
      return this.chatClientGpt35
    } else if (deploymentName === this.azureOpenAIEmbeddingDeploymentName) {
      if (!this.embeddingClient) {
        throw new Error(
          `Embedding client (${this.azureOpenAIEmbeddingDeploymentName}) is not initialized.`,
        )
      }
      return this.embeddingClient
    }
    throw new Error(`No client configured for deployment: ${deploymentName}`)
  }

  getGpt4DeploymentName(): string | undefined {
    return this.azureOpenAIDeploymentNameGpt4
  }

  getGpt35DeploymentName(): string | undefined {
    return this.azureOpenAIDeploymentNameGpt35
  }

  getEmbeddingDeploymentName(): string | undefined {
    return this.azureOpenAIEmbeddingDeploymentName
  }

  async getChatCompletion(
    deploymentName: string,
    messages: ChatCompletionCreateParamsNonStreaming['messages'],
    options?: Omit<Partial<ChatCompletionCreateParamsNonStreaming>, 'model'>,
  ): Promise<ChatCompletion> {
    const client = this.getClientByDeploymentName(deploymentName)
    const modelInOptions = options?.model ?? 'N/A'
    try {
      this.logger.debug(
        `Requesting chat completion from deployment: ${deploymentName}, model in options: ${modelInOptions}`,
      )

      const response = await client.chat.completions.create({
        model: deploymentName,
        messages,
        ...options,
      })
      this.logger.log(
        `Received chat completion from ${deploymentName}. Usage: ${JSON.stringify(response.usage)}`,
      )
      return response
    } catch (error: unknown) {
      this.handleApiError(error, `getChatCompletion for ${deploymentName}`)
      if (error instanceof Error) {
        throw error
      }
      let errorMessage =
        'An unknown non-Error exception occurred during getChatCompletion.'
      try {
        errorMessage = `An non-Error exception occurred during getChatCompletion: ${JSON.stringify(error)}`
      } catch (stringifyError) {
        this.logger.error(
          'Failed to stringify non-Error exception',
          stringifyError,
        )
      }
      throw new Error(errorMessage)
    }
  }

  async getChatCompletionStream(
    deploymentName: string,
    messages: ChatCompletionCreateParamsStreaming['messages'],
    options?: Omit<Partial<ChatCompletionCreateParamsStreaming>, 'model'>,
  ): Promise<AsyncIterable<ChatCompletionChunk>> {
    const client = this.getClientByDeploymentName(deploymentName)
    const modelInOptions = options?.model ?? 'N/A'
    try {
      this.logger.debug(
        `Requesting streaming chat completion from deployment: ${deploymentName}, model in options: ${modelInOptions}`,
      )

      const stream = await client.chat.completions.create({
        model: deploymentName,
        messages,
        ...options,
        stream: true,
      })
      this.logger.log(
        `Streaming chat completion started from ${deploymentName}.`,
      )
      return stream as unknown as AsyncIterable<ChatCompletionChunk>
    } catch (error: unknown) {
      this.handleApiError(
        error,
        `getChatCompletionStream for ${deploymentName}`,
      )
      if (error instanceof Error) {
        throw error
      }
      let errorMessage =
        'An unknown non-Error exception occurred during getChatCompletionStream.'
      try {
        errorMessage = `An non-Error exception occurred during getChatCompletionStream: ${JSON.stringify(error)}`
      } catch (stringifyError) {
        this.logger.error(
          'Failed to stringify non-Error exception',
          stringifyError,
        )
      }
      throw new Error(errorMessage)
    }
  }

  async createEmbedding(
    deploymentName: string,
    input: EmbeddingCreateParams['input'],
    options?: Omit<Partial<EmbeddingCreateParams>, 'model'>,
  ): Promise<CreateEmbeddingResponse> {
    if (!this.embeddingClient) {
      this.logger.error(
        'Embedding client is not initialized. Check AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME.',
      )
      throw new Error('Embedding client is not initialized.')
    }
    const client = this.embeddingClient

    try {
      this.logger.debug(
        `Requesting embedding from deployment: ${deploymentName} (using embedding client). Input type: ${typeof input}, length/content: ${typeof input === 'string' ? input.length : Array.isArray(input) ? input.length : 'object'}`,
      )

      const response = await client.embeddings.create({
        model: deploymentName,
        input,
        ...options,
      })
      this.logger.log(
        `Received embedding from ${deploymentName}. Usage: ${JSON.stringify(response.usage)}`,
      )
      return response
    } catch (error: unknown) {
      this.handleApiError(error, `createEmbedding for ${deploymentName}`)
      if (error instanceof Error) {
        throw error
      }
      let errorMessage =
        'An unknown non-Error exception occurred during createEmbedding.'
      try {
        errorMessage = `An non-Error exception occurred during createEmbedding: ${JSON.stringify(error)}`
      } catch (stringifyError) {
        this.logger.error(
          'Failed to stringify non-Error exception',
          stringifyError,
        )
      }
      throw new Error(errorMessage)
    }
  }

  private handleApiError(error: unknown, context: string): void {
    if (error instanceof APIError) {
      this.logger.error(
        `Azure OpenAI API Error during [${context}]: ${error.status} ${error.name} - ${error.message}`,
        error.stack,
      )
      if (error.headers) {
        this.logger.error(`Error Headers: ${JSON.stringify(error.headers)}`)
      }
      if (error.error && typeof error.error === 'object') {
        const errorDetails = error.error as {
          message?: string
          [key: string]: any
        }
        if (errorDetails.message) {
          this.logger.error(`Error Details: ${errorDetails.message}`)
        } else {
          this.logger.error(`Error Details: ${JSON.stringify(error.error)}`)
        }
      } else if (error.error) {
        this.logger.error(`Error Details: ${String(error.error)}`)
      }
    } else if (error instanceof Error) {
      this.logger.error(
        `Generic Error during [${context}]: ${error.message}`,
        error.stack,
      )
    } else {
      this.logger.error(
        `Unknown error during [${context}]: ${JSON.stringify(error)}`,
      )
    }
  }
}
