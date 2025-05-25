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
import OpenAI from 'openai'
import type { Responses } from 'openai/resources/responses/responses'

export interface OpenaiResponseInputMessage {
  role: 'user' | 'assistant' | 'system' | 'developer'
  content: string | Responses.ResponseInputMessageContentList
}

export interface OpenaiResponseCreateParams {
  model: string
  instructions?: string
  input: string | Responses.ResponseInput
  tools?: Responses.Tool[]
  tool_choice?:
    | Responses.ToolChoiceOptions
    | Responses.ToolChoiceTypes
    | Responses.ToolChoiceFunction
  previous_response_id?: string
  temperature?: number
  max_output_tokens?: number
  top_p?: number
  stream?: boolean
  text?: Responses.ResponseTextConfig
  metadata?: OpenAI.Metadata
}

// เพิ่ม type definitions สำหรับ Responses API
export interface ResponsesApiUsage {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
}

export interface ResponsesApiContentItem {
  type: 'output_text' | 'text'
  text?: string
}

export interface ResponsesApiMessage {
  type: 'message'
  role: 'assistant' | 'user' | 'system'
  content: string | ResponsesApiContentItem[]
}

export interface ResponsesApiFunctionCall {
  type: 'function_call'
  name: string
  arguments: string
}

export interface ResponsesApiOutput {
  output?: (ResponsesApiMessage | ResponsesApiFunctionCall)[]
  output_text?: string
  usage?: ResponsesApiUsage
}

// Type guard functions
export function isResponsesApiMessage(
  item: unknown,
): item is ResponsesApiMessage {
  return (
    typeof item === 'object' &&
    item !== null &&
    'type' in item &&
    (item as { type: unknown }).type === 'message'
  )
}

export function isResponsesApiFunctionCall(
  item: unknown,
): item is ResponsesApiFunctionCall {
  return (
    typeof item === 'object' &&
    item !== null &&
    'type' in item &&
    (item as { type: unknown }).type === 'function_call'
  )
}

export function hasOutputArray(
  response: unknown,
): response is { output: unknown[] } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'output' in response &&
    Array.isArray((response as { output: unknown }).output)
  )
}

export function hasOutputText(
  response: unknown,
): response is { output_text: string } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'output_text' in response &&
    typeof (response as { output_text: unknown }).output_text === 'string'
  )
}

export function hasUsage(
  response: unknown,
): response is { usage: ResponsesApiUsage } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'usage' in response &&
    typeof (response as { usage: unknown }).usage === 'object' &&
    (response as { usage: unknown }).usage !== null
  )
}

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name)
  private chatClientGpt4: AzureOpenAI | null = null
  private chatClientGpt4Mini: AzureOpenAI | null = null
  private embeddingClient: AzureOpenAI | null = null
  private azureOpenAiClient?: AzureOpenAI
  private azureOpenAiEmbeddingClient?: AzureOpenAI
  private azureOpenAiNanoClient?: AzureOpenAI

  private readonly azureOpenAIApiEndpoint: string
  private readonly azureOpenAIApiVersion: string
  private readonly azureOpenAIEmbeddingApiVersion: string
  private readonly azureOpenAIDeploymentNameGpt4: string | undefined
  private readonly azureOpenAIDeploymentNameGpt4Mini: string | undefined
  private readonly azureOpenAIDeploymentNameGpt4Nano: string | undefined
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
    this.azureOpenAIDeploymentNameGpt4Mini = this.configService.get<string>(
      'AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_MINI',
    )
    this.azureOpenAIDeploymentNameGpt4Nano = this.configService.get<string>(
      'AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_NANO',
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

    if (this.azureOpenAIDeploymentNameGpt4Mini) {
      this.chatClientGpt4Mini = new AzureOpenAI({
        endpoint: this.azureOpenAIApiEndpoint,
        apiVersion: this.azureOpenAIApiVersion,
        deployment: this.azureOpenAIDeploymentNameGpt4Mini,
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
        `AzureOpenAI client initialized for GPT-4.1 (mini): ${this.azureOpenAIDeploymentNameGpt4Mini} using Entra ID`,
      )
    } else {
      this.logger.warn(
        'AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_MINI is not configured. GPT-4.1 (mini) client will not be available.',
      )
    }

    if (this.azureOpenAIDeploymentNameGpt4Nano) {
      this.azureOpenAiNanoClient = new AzureOpenAI({
        endpoint: this.azureOpenAIApiEndpoint,
        apiVersion: this.azureOpenAIApiVersion,
        deployment: this.azureOpenAIDeploymentNameGpt4Nano,
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
        `AzureOpenAI client initialized for GPT-4.1 (nano): ${this.azureOpenAIDeploymentNameGpt4Nano} using Entra ID`,
      )
    } else {
      this.logger.warn(
        'AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_NANO is not configured. GPT-4.1 (nano) client will not be available.',
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

    if (!this.chatClientGpt4 && !this.chatClientGpt4Mini) {
      this.logger.error(
        'No chat clients (GPT-4 or GPT-4.1-mini) could be initialized. Check deployment name configurations.',
      )
    }
  }

  private getClientByDeploymentName(deploymentName: string): AzureOpenAI {
    if (
      deploymentName === this.azureOpenAIDeploymentNameGpt4 &&
      this.chatClientGpt4
    ) {
      return this.chatClientGpt4
    }
    if (
      deploymentName === this.azureOpenAIDeploymentNameGpt4Mini &&
      this.chatClientGpt4Mini
    ) {
      return this.chatClientGpt4Mini
    }
    if (
      deploymentName === this.azureOpenAIDeploymentNameGpt4Nano &&
      this.azureOpenAiNanoClient
    ) {
      return this.azureOpenAiNanoClient
    }
    if (this.chatClientGpt4) {
      this.logger.warn(
        `Deployment name ${deploymentName} not directly mapped to a client, using GPT-4 client as fallback.`,
      )
      return this.chatClientGpt4
    }
    if (this.chatClientGpt4Mini) {
      this.logger.warn(
        `Deployment name ${deploymentName} not directly mapped to a client, and GPT-4 client not available. Using GPT-4.1-mini client as fallback.`,
      )
      return this.chatClientGpt4Mini
    }
    throw new Error(
      `No suitable client configured or available for deployment: ${deploymentName}. Check Azure deployment names.`,
    )
  }

  getGpt41DeploymentName(): string | undefined {
    return this.azureOpenAIDeploymentNameGpt4
  }

  getGpt41_miniModelDeployment(): string | undefined {
    return this.azureOpenAIDeploymentNameGpt4Mini
  }

  getGpt41_nanoModelDeployment(): string | undefined {
    return this.azureOpenAIDeploymentNameGpt4Nano
  }

  getEmbeddingDeploymentName(): string | undefined {
    return this.azureOpenAIEmbeddingDeploymentName
  }

  async getChatCompletion(
    deploymentName: string,
    messages: ChatCompletionCreateParamsNonStreaming['messages'],
    options?: Omit<Partial<ChatCompletionCreateParamsNonStreaming>, 'model'>,
    userId?: string, // Added for prompt caching optimization
  ): Promise<ChatCompletion> {
    const client = this.getClientByDeploymentName(deploymentName)
    const modelInOptions = options?.model ?? deploymentName
    try {
      this.logger.debug(
        `Requesting chat completion from deployment: ${deploymentName}, effective model: ${modelInOptions}`,
      )

      const response = await client.chat.completions.create({
        model: modelInOptions,
        messages,
        ...options,
        ...(userId && { user: userId }), // Add user parameter for prompt caching optimization
      })
      this.logger.log(
        `Received chat completion from ${deploymentName}. Usage: ${JSON.stringify(response.usage)}`,
      )

      // Log cache performance for prompt caching optimization
      if (response.usage?.prompt_tokens_details?.cached_tokens) {
        const cachedTokens = response.usage.prompt_tokens_details.cached_tokens
        const totalPromptTokens = response.usage.prompt_tokens
        const cacheHitRate = ((cachedTokens / totalPromptTokens) * 100).toFixed(
          1,
        )
        this.logger.log(
          `🎯 Prompt Cache HIT: ${cachedTokens}/${totalPromptTokens} tokens (${cacheHitRate}%) for ${deploymentName}${userId ? ` (user: ${userId})` : ''}`,
        )
      } else if (
        response.usage?.prompt_tokens &&
        response.usage.prompt_tokens >= 1024
      ) {
        this.logger.log(
          `❌ Prompt Cache MISS: No cached tokens for eligible prompt (${response.usage.prompt_tokens} tokens) on ${deploymentName}${userId ? ` (user: ${userId})` : ''}`,
        )
      }

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
    const modelInOptions = options?.model ?? deploymentName
    try {
      this.logger.debug(
        `Requesting streaming chat completion from deployment: ${deploymentName}, effective model: ${modelInOptions}`,
      )

      const stream = await client.chat.completions.create({
        model: modelInOptions,
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
    const modelForRequest = options?.model ?? deploymentName

    try {
      this.logger.debug(
        `Requesting embedding from embedding client (deployment: ${this.azureOpenAIEmbeddingDeploymentName}). Effective model for request: ${modelForRequest}. Input type: ${typeof input}, length/content: ${typeof input === 'string' ? input.length : Array.isArray(input) ? input.length : 'object'}`,
      )

      const response = await this.embeddingClient.embeddings.create({
        model: modelForRequest,
        input,
        ...options,
      })
      this.logger.log(
        `Received embedding from ${this.azureOpenAIEmbeddingDeploymentName}. Usage: ${JSON.stringify(response.usage)}`,
      )
      return response
    } catch (error: unknown) {
      this.handleApiError(
        error,
        `createEmbedding for ${this.azureOpenAIEmbeddingDeploymentName} (model: ${modelForRequest})`,
      )
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

  async createOpenaiResponse(
    deploymentNameOrModelTag: string,
    params: OpenaiResponseCreateParams,
  ): Promise<Responses.Response | { error: string }> {
    const client = this.getClientByDeploymentName(deploymentNameOrModelTag)

    try {
      this.logger.debug(
        `Requesting OpenAI Response via client for deployment/tag: ${deploymentNameOrModelTag}, actual model in API call: ${params.model}`,
      )

      const baseRequestParams: Omit<Responses.ResponseCreateParams, 'stream'> =
        {
          model: params.model,
          input: params.input as Responses.ResponseInput,
          instructions: params.instructions,
          tools: params.tools,
          tool_choice: params.tool_choice,
          previous_response_id: params.previous_response_id,
          temperature: params.temperature,
          max_output_tokens: params.max_output_tokens,
          top_p: params.top_p,
          text: params.text,
          metadata: params.metadata,
        }

      if (params.stream) {
        this.logger.warn(
          "Streaming for Responses API is not explicitly handled in this method's return type; it would return Stream<Responses.ResponseStreamEvent>.",
        )
        throw new Error(
          'Streaming for Responses API call needs a different handler or return type.',
        )
      }

      const finalRequestParams: Responses.ResponseCreateParamsNonStreaming = {
        ...baseRequestParams,
        stream: false,
      }

      const response: Responses.Response =
        await client.responses.create(finalRequestParams)

      this.logger.log(
        `Received OpenAI Response (ID: ${response.id}) using client for ${deploymentNameOrModelTag}.`,
      )
      return response
    } catch (error: unknown) {
      this.handleApiError(
        error,
        `createOpenaiResponse for ${deploymentNameOrModelTag} (model: ${params.model})`,
      )
      if (error instanceof Error) {
        return { error: error.message }
      }
      const errorString =
        typeof error === 'string' ? error : JSON.stringify(error)
      const errorMessage = `An unknown non-Error exception occurred during createOpenaiResponse: ${errorString}`
      this.logger.error(errorMessage)
      return { error: errorMessage }
    }
  }

  private handleApiError(error: unknown, context: string): void {
    if (error instanceof APIError) {
      this.logger.error(
        `${context} - API Error: ${error.status} ${error.message}`,
      )
      if (error.headers) {
        this.logger.error(`Error Headers: ${JSON.stringify(error.headers)}`)
      }
      // Type-safe error details handling
      if (error.error && typeof error.error === 'object') {
        const errorDetails = error.error as Record<string, unknown>
        if (typeof errorDetails.message === 'string') {
          this.logger.error(`Error Details: ${errorDetails.message}`)
        } else {
          this.logger.error(
            `Error Details (object without string message): ${JSON.stringify(errorDetails)}`,
          )
        }
      }
    } else {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`${context} - General Error: ${message}`)
    }
  }
}
