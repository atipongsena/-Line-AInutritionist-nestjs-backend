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
import { type Response as ResponsesResponse } from 'openai/resources/responses/responses'

export interface OpenaiResponseInputMessage {
  role: 'user' | 'assistant' | 'system' | 'developer'
  content: string | OpenAI.Responses.ResponseInputMessageContentList
}

export interface OpenaiResponseCreateParams {
  instructions?: string
  input: string | OpenAI.Responses.ResponseInput
  tools?: OpenAI.Responses.Tool[]
  tool_choice?:
    | OpenAI.Responses.ToolChoiceOptions
    | OpenAI.Responses.ToolChoiceTypes
    | OpenAI.Responses.ToolChoiceFunction
  previous_response_id?: string
  temperature?: number
  max_output_tokens?: number
  top_p?: number
  stream?: boolean
  text?: OpenAI.Responses.ResponseTextConfig
  metadata?: OpenAI.Metadata
}

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name)
  private clients: Map<string, AzureOpenAI> = new Map()

  private readonly azureOpenAIApiEndpoint: string
  private readonly azureOpenAIApiVersion: string
  private readonly azureOpenAIEmbeddingApiVersion: string

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

    if (!this.azureOpenAIApiEndpoint) {
      this.logger.error('AZURE_OPENAI_ENDPOINT is not configured.')
      throw new Error('Azure OpenAI API endpoint is not configured.')
    }
    if (!this.azureOpenAIApiVersion) {
      this.logger.error('AZURE_OPENAI_API_VERSION is not configured.')
      throw new Error('Azure OpenAI API version is not configured.')
    }

    const tokenCredential = new DefaultAzureCredential()

    const deploymentConfigs: Array<{
      configName: string
      deploymentNameKey: string
      endpointKeySuffix: string
      apiVersionKeySuffix: string
      isEmbedding: boolean
    }> = [
      {
        configName: 'GPT-4.1',
        deploymentNameKey: 'AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1',
        endpointKeySuffix: '_GPT4_1',
        apiVersionKeySuffix: '_GPT4_1',
        isEmbedding: false,
      },
      {
        configName: 'GPT-4.1-Mini',
        deploymentNameKey: 'AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_MINI',
        endpointKeySuffix: '_GPT4_1_MINI',
        apiVersionKeySuffix: '_GPT4_1_MINI',
        isEmbedding: false,
      },
      {
        configName: 'GPT-4.1-Nano',
        deploymentNameKey: 'AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_NANO',
        endpointKeySuffix: '_GPT4_1_NANO',
        apiVersionKeySuffix: '_GPT4_1_NANO',
        isEmbedding: false,
      },
      {
        configName: 'Embedding',
        deploymentNameKey: 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME',
        endpointKeySuffix: '_EMBEDDING',
        apiVersionKeySuffix: '_EMBEDDING',
        isEmbedding: true,
      },
    ]

    for (const config of deploymentConfigs) {
      const deploymentName = this.configService.get<string>(
        config.deploymentNameKey,
      )
      if (!deploymentName) {
        this.logger.warn(
          `${config.deploymentNameKey} is not configured. Client for ${config.configName} will not be available.`,
        )
        continue
      }

      const specificEndpoint = this.configService.get<string>(
        `AZURE_OPENAI_ENDPOINT${config.endpointKeySuffix}`,
      )
      const endpointToUse = specificEndpoint || this.azureOpenAIApiEndpoint

      const specificApiVersion = this.configService.get<string>(
        `AZURE_OPENAI_API_VERSION${config.apiVersionKeySuffix}`,
      )
      const apiVersionToUse =
        specificApiVersion ||
        (config.isEmbedding
          ? this.azureOpenAIEmbeddingApiVersion
          : this.azureOpenAIApiVersion)

      if (!endpointToUse) {
        this.logger.error(
          `Endpoint for ${deploymentName} (${config.configName}) could not be determined and is not configured.`,
        )
        continue
      }
      if (!apiVersionToUse) {
        this.logger.error(
          `API version for ${deploymentName} (${config.configName}) could not be determined and is not configured.`,
        )
        continue
      }

      try {
        const client = new AzureOpenAI({
          endpoint: endpointToUse,
          apiVersion: apiVersionToUse,
          deployment: deploymentName,
          azureADTokenProvider: async () => {
            const accessToken = await tokenCredential.getToken(
              'https://cognitiveservices.azure.com/.default',
            )
            if (!accessToken) {
              throw new Error(
                'Failed to get token from DefaultAzureCredential for ' +
                  deploymentName,
              )
            }
            return accessToken.token
          },
        })
        this.clients.set(deploymentName, client)
        this.logger.log(
          `AzureOpenAI client initialized for ${config.configName} (Deployment: ${deploymentName}) using Endpoint: ${endpointToUse}, APIVersion: ${apiVersionToUse}, with Entra ID`,
        )
      } catch (error) {
        this.logger.error(
          `Failed to initialize AzureOpenAI client for ${config.configName} (Deployment: ${deploymentName}): ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  private getClient(deploymentName: string): AzureOpenAI {
    const client = this.clients.get(deploymentName)
    if (!client) {
      this.logger.error(
        `Azure OpenAI client for deployment "${deploymentName}" is not initialized or not found. Check configuration.`,
      )
      throw new Error(
        `Azure OpenAI client for deployment "${deploymentName}" is not available.`,
      )
    }
    return client
  }

  getGpt41DeploymentName(): string | undefined {
    return this.configService.get<string>('AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1')
  }

  getGpt41_miniModelDeployment(): string | undefined {
    return this.configService.get<string>(
      'AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_MINI',
    )
  }

  getGpt41_nanoModelDeployment(): string | undefined {
    return this.configService.get<string>(
      'AZURE_OPENAI_DEPLOYMENT_NAME_GPT4_1_NANO',
    )
  }

  getEmbeddingDeploymentName(): string | undefined {
    return this.configService.get<string>(
      'AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME',
    )
  }

  async getChatCompletion(
    deploymentName: string,
    messages: ChatCompletionCreateParamsNonStreaming['messages'],
    options?: Omit<Partial<ChatCompletionCreateParamsNonStreaming>, 'model'>,
    userId?: string,
  ): Promise<ChatCompletion> {
    const client = this.getClient(deploymentName)

    this.logger.debug(
      `[getChatCompletion] Deployment: ${deploymentName}, Messages: ${JSON.stringify(
        messages,
      )}, Options: ${JSON.stringify(options)}, UserId: ${userId}`,
    )

    try {
      const response = await client.chat.completions.create({
        model: deploymentName,
        messages,
        ...options,
        user: userId,
      })
      this.logger.debug(
        `[getChatCompletion] Response for ${deploymentName}: ${JSON.stringify(response)}`,
      )
      return response
    } catch (error) {
      this.handleApiError(error, `getChatCompletion for ${deploymentName}`)
      throw error
    }
  }

  async getChatCompletionStream(
    deploymentName: string,
    messages: ChatCompletionCreateParamsStreaming['messages'],
    options?: Omit<Partial<ChatCompletionCreateParamsStreaming>, 'model'>,
  ): Promise<AsyncIterable<ChatCompletionChunk>> {
    const client = this.getClient(deploymentName)

    this.logger.debug(
      `[getChatCompletionStream] Deployment: ${deploymentName}, Messages: ${JSON.stringify(
        messages,
      )}, Options: ${JSON.stringify(options)}`,
    )

    try {
      const stream = await client.chat.completions.create({
        model: deploymentName,
        messages,
        ...options,
        stream: true,
      })
      return stream
    } catch (error) {
      this.handleApiError(
        error,
        `getChatCompletionStream for ${deploymentName}`,
      )
      throw error
    }
  }

  async createEmbedding(
    deploymentName: string,
    input: EmbeddingCreateParams['input'],
    options?: Omit<Partial<EmbeddingCreateParams>, 'model'>,
  ): Promise<CreateEmbeddingResponse> {
    const client = this.getClient(deploymentName)

    this.logger.debug(
      `[createEmbedding] Deployment: ${deploymentName}, Input type: ${typeof input}, Options: ${JSON.stringify(
        options,
      )}`,
    )
    if (typeof input === 'string') {
      this.logger.debug(
        `[createEmbedding] Input string length: ${input.length}`,
      )
    } else if (Array.isArray(input)) {
      this.logger.debug(`[createEmbedding] Input array length: ${input.length}`)
    }

    try {
      const response = await client.embeddings.create({
        model: deploymentName,
        input,
        ...options,
      })
      this.logger.debug(
        `[createEmbedding] Response for ${deploymentName} (Usage): ${JSON.stringify(response.usage)}`,
      )
      return response
    } catch (error) {
      this.handleApiError(error, `createEmbedding for ${deploymentName}`)
      throw error
    }
  }

  async createOpenaiResponse(
    deploymentNameOrModelTag: string,
    params: OpenaiResponseCreateParams,
  ): Promise<OpenAI.Responses.Response | { error: string }> {
    this.logger.debug(
      `[createOpenaiResponse] Received request for deployment/tag: ${deploymentNameOrModelTag}`,
    )
    this.logger.verbose(
      `[createOpenaiResponse] Params: ${JSON.stringify(params)}`,
    )

    const deploymentName =
      this.configService.get<string>(
        `AZURE_OPENAI_DEPLOYMENT_NAME_${deploymentNameOrModelTag.toUpperCase()}`,
      ) || deploymentNameOrModelTag

    const client = this.getClient(deploymentName)
    if (!client) {
      const errorMsg = `[createOpenaiResponse] Failed to get OpenAI client for deployment: ${deploymentName}`
      this.logger.error(errorMsg)
      return { error: errorMsg }
    }

    try {
      if (params.stream) {
        this.logger.warn(
          '[createOpenaiResponse] Streaming is requested but full streaming support in this refactor is pending.',
        )
        // TEMPORARY: Force non-streaming even if requested, matching structure for ResponseCreateParamsNonStreaming
        const requestPayload: OpenAI.Responses.ResponseCreateParamsNonStreaming =
          {
            model: deploymentName, // Crucial for routing in "Last Generation API" style
            input: params.input,
            instructions: params.instructions,
            tools: params.tools,
            tool_choice: params.tool_choice,
            previous_response_id: params.previous_response_id,
            temperature: params.temperature,
            max_output_tokens: params.max_output_tokens,
            top_p: params.top_p,
            text: params.text,
            metadata: params.metadata,
            stream: false, // Explicitly false for NonStreaming
          }
        const response = await client.responses.create(requestPayload)
        this.logger.debug(
          `[createOpenaiResponse] Received (forced non-streaming) response: ${JSON.stringify(response)}`,
        )
        return response
      } else {
        const requestPayload: OpenAI.Responses.ResponseCreateParamsNonStreaming =
          {
            model: deploymentName, // Crucial for routing in "Last Generation API" style
            input: params.input,
            instructions: params.instructions,
            tools: params.tools,
            tool_choice: params.tool_choice,
            previous_response_id: params.previous_response_id,
            temperature: params.temperature,
            max_output_tokens: params.max_output_tokens,
            top_p: params.top_p,
            text: params.text,
            metadata: params.metadata,
            stream: false, // Explicitly false for NonStreaming
          }
        const response = await client.responses.create(requestPayload)
        this.logger.debug(
          `[createOpenaiResponse] Received response: ${JSON.stringify(response)}`,
        )
        return response
      }
    } catch (error) {
      this.handleApiError(error, 'createOpenaiResponse')
      const errorMessage =
        error instanceof APIError
          ? error.message
          : 'An unexpected error occurred with OpenAI.'
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
