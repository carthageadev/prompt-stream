"""
Database models and API schemas.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()


class BlockType(str, Enum):
    persona = "persona"
    context = "context"
    constraint = "constraint"
    format = "format"
    instruction = "instruction"
    example = "example"


class CompositionItemKind(str, Enum):
    prompt = "prompt"
    inline = "inline"


class CompositionSection(str, Enum):
    role = "role"
    context = "context"
    rules = "rules"
    examples = "examples"
    output = "output"
    freeform = "freeform"


class TagColorModel(Base):
    __tablename__ = "tag_colors"

    name = Column(String, primary_key=True)
    hue = Column(Integer, nullable=False)
    lightness = Column(Integer, nullable=False, server_default=text("32"))


class StackModel(Base):
    __tablename__ = "stacks"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    is_published = Column(Boolean, nullable=False, server_default=text("false"))
    theme_key = Column(String, nullable=False, server_default=text("'midnight-grid'"))
    cover_image = Column(String, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    blocks = relationship("PromptBlockModel", back_populates="stack")


class PromptBlockModel(Base):
    __tablename__ = "prompt_blocks"

    id = Column(String, primary_key=True)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(JSON, default=list)
    stack_id = Column(String, ForeignKey("stacks.id"), nullable=True)
    stack_order = Column(Integer, nullable=True)
    parent_prompt_id = Column(String, nullable=True)
    root_prompt_id = Column(String, nullable=True)
    fork_note = Column(Text, nullable=True)
    derived_from_stack_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    stack = relationship("StackModel", back_populates="blocks")


class CompositionModel(Base):
    __tablename__ = "compositions"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    source_stack_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    items = relationship(
        "CompositionItemModel",
        back_populates="composition",
        cascade="all, delete-orphan",
        order_by="CompositionItemModel.position.asc()",
    )


class CompositionItemModel(Base):
    __tablename__ = "composition_items"

    id = Column(String, primary_key=True)
    composition_id = Column(String, ForeignKey("compositions.id"), nullable=False)
    source_prompt_id = Column(String, nullable=True)
    kind = Column(String, nullable=False)
    content = Column(Text, nullable=False, server_default=text("''"))
    section = Column(String, nullable=False)
    position = Column(Integer, nullable=False, server_default=text("0"))
    label = Column(String, nullable=True)

    composition = relationship("CompositionModel", back_populates="items")


class PromptInsightModel(Base):
    __tablename__ = "prompt_insights"

    prompt_id = Column(String, primary_key=True)
    content_hash = Column(String, nullable=False)
    suggested_tags = Column(JSON, nullable=False, server_default=text("'[]'::json"))
    tag_merge_suggestions = Column(
        JSON, nullable=False, server_default=text("'[]'::json")
    )
    scorecard = Column(JSON, nullable=True)
    semantic_profile = Column(JSON, nullable=True)
    related_prompt_ids = Column(JSON, nullable=False, server_default=text("'[]'::json"))
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PromptBlockBase(BaseModel):
    type: BlockType
    title: str
    content: str
    tags: list[str] = Field(default_factory=list)
    stack_id: Optional[str] = None
    stack_order: Optional[int] = None
    parent_prompt_id: Optional[str] = None
    root_prompt_id: Optional[str] = None
    fork_note: Optional[str] = None
    derived_from_stack_id: Optional[str] = None


class PromptBlockCreate(PromptBlockBase):
    id: str


class PromptBlockUpdate(BaseModel):
    type: Optional[BlockType] = None
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list[str]] = None
    stack_id: Optional[str] = None
    stack_order: Optional[int] = None
    parent_prompt_id: Optional[str] = None
    root_prompt_id: Optional[str] = None
    fork_note: Optional[str] = None
    derived_from_stack_id: Optional[str] = None


class PromptBlock(PromptBlockBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TagColorBase(BaseModel):
    name: str
    hue: int
    lightness: int = 32


class TagColorCreate(TagColorBase):
    pass


class TagColor(TagColorBase):
    model_config = ConfigDict(from_attributes=True)


class StackBase(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    is_published: bool = False
    theme_key: str = "midnight-grid"
    cover_image: Optional[str] = None
    published_at: Optional[datetime] = None


class StackCreate(StackBase):
    id: str


class StackUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    is_published: Optional[bool] = None
    theme_key: Optional[str] = None
    cover_image: Optional[str] = None
    published_at: Optional[datetime] = None


class StackPublishRequest(BaseModel):
    is_published: bool
    slug: Optional[str] = None


class Stack(StackBase):
    id: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PublicStackResponse(BaseModel):
    stack: Stack
    prompts: list[PromptBlock]


class LineageResponse(BaseModel):
    prompt: PromptBlock
    ancestors: list[PromptBlock]
    descendants: list[PromptBlock]


class ForkPromptRequest(BaseModel):
    title: Optional[str] = None
    fork_note: Optional[str] = None
    stack_id: Optional[str] = None


class CompositionItemBase(BaseModel):
    source_prompt_id: Optional[str] = None
    kind: CompositionItemKind
    content: str = ""
    section: CompositionSection
    position: int = 0
    label: Optional[str] = None


class CompositionItemCreate(CompositionItemBase):
    id: str


class CompositionItemUpdate(BaseModel):
    id: str
    source_prompt_id: Optional[str] = None
    kind: CompositionItemKind
    content: str = ""
    section: CompositionSection
    position: int = 0
    label: Optional[str] = None


class CompositionBase(BaseModel):
    name: str
    description: Optional[str] = None
    source_stack_id: Optional[str] = None


class CompositionCreate(CompositionBase):
    id: str
    items: list[CompositionItemCreate] = Field(default_factory=list)


class CompositionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    source_stack_id: Optional[str] = None
    items: Optional[list[CompositionItemUpdate]] = None


class CompositionItem(BaseModel):
    id: str
    composition_id: str
    source_prompt_id: Optional[str] = None
    kind: CompositionItemKind
    content: str = ""
    section: CompositionSection
    position: int
    label: Optional[str] = None
    prompt: Optional[PromptBlock] = None

    model_config = ConfigDict(from_attributes=True)


class Composition(CompositionBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: list[CompositionItem] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class TagMergeSuggestion(BaseModel):
    source: str
    target: str
    reason: str


class TagSuggestionResponse(BaseModel):
    prompt_id: str
    cached: bool = False
    suggested_tags: list[str] = Field(default_factory=list)
    merge_suggestions: list[TagMergeSuggestion] = Field(default_factory=list)


class QualityScorecard(BaseModel):
    clarity: int
    specificity: int
    constraints: int
    output_definition: int
    reuse_potential: int
    ambiguity_risk: int
    summary: str
    recommendations: list[str] = Field(default_factory=list)


class SemanticProfile(BaseModel):
    intent: str
    output_style: str
    keywords: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    personas: list[str] = Field(default_factory=list)


class RelatedPromptResult(BaseModel):
    prompt: PromptBlock
    score: float
    reason: str


class RelatedPromptsResponse(BaseModel):
    prompt_id: str
    cached: bool = False
    semantic_profile: SemanticProfile
    results: list[RelatedPromptResult] = Field(default_factory=list)


class PromptInsight(BaseModel):
    prompt_id: str
    content_hash: str
    suggested_tags: list[str] = Field(default_factory=list)
    tag_merge_suggestions: list[dict[str, Any]] = Field(default_factory=list)
    scorecard: Optional[QualityScorecard] = None
    semantic_profile: Optional[SemanticProfile] = None
    related_prompt_ids: list[str] = Field(default_factory=list)
    generated_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SemanticSearchRequest(BaseModel):
    query: str
    active_tags: list[str] = Field(default_factory=list)
    stack_id: Optional[str] = None
    limit: int = 20


class SemanticSearchResult(BaseModel):
    prompt_id: str
    score: float
    reason: str


class SemanticSearchResponse(BaseModel):
    query: str
    results: list[SemanticSearchResult] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    database: str


class OptimizeRequest(BaseModel):
    prompt: str


class OptimizeResponse(BaseModel):
    text: str
